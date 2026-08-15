'use strict';

ObjC.import('Foundation');
ObjC.import('stdlib');

var DEFAULT_LIMIT = 50;
var MAX_LIMIT = 200;
var DEFAULT_LIST_SCAN_LIMIT = 500;
var MAX_LIST_SCAN_LIMIT = 2000;
var ACCOUNT_ID_SCAN_LIMIT = 100;
var FOLDER_ID_SCAN_LIMIT = 5000;
var NOTE_ID_SCAN_LIMIT = 10000;
var MAX_FOLDER_DEPTH = 64;
var MAX_QUERY_LENGTH = 500;
var MAX_TITLE_LENGTH = 1000;
var MAX_CONTEXT_JSON_LENGTH = 32768;
var MAX_STDIN_BYTES = 10 * 1024 * 1024;
var STDIN_CHUNK_BYTES = 64 * 1024;

function fail(code, message, details) {
  var error = new Error(message);
  error.bridgeCode = code;
  error.bridgeDetails = details || {};
  throw error;
}

function asString(value) {
  if (value === null || value === undefined) {
    return '';
  }
  try {
    return String(ObjC.unwrap(value));
  } catch (_error) {
    return String(value);
  }
}

function asBoolean(value) {
  try {
    return Boolean(ObjC.unwrap(value));
  } catch (_error) {
    return Boolean(value);
  }
}

function collectionCount(app, collection, label) {
  var count = Number(app.count(collection));
  if (!isFinite(count) || count < 0 || Math.floor(count) !== count) {
    fail('INVALID_COLLECTION_COUNT', 'Notes returned an invalid collection count.', {
      collection: label,
    });
  }
  return count;
}

function indexedElementId(collection, index, label) {
  var id;
  try {
    id = asString(collection[index].id());
  } catch (_error) {
    fail('COLLECTION_CHANGED', 'A Notes collection changed during its bounded scan.', {
      collection: label,
      index: index,
    });
  }
  if (id === '') {
    fail('COLLECTION_CHANGED', 'Notes returned an empty stable ID during a bounded scan.', {
      collection: label,
      index: index,
    });
  }
  return id;
}

function stableElementById(collection, expectedId, label) {
  var ref;
  var actualId;
  try {
    ref = collection.byId(expectedId);
    actualId = asString(ref.id());
  } catch (_error) {
    fail('ID_REBIND_FAILED', 'A Notes element could not be rebound by its stable ID.', {
      collection: label,
      expected_id: expectedId,
    });
  }
  if (actualId !== expectedId) {
    fail('ID_REBIND_FAILED', 'Notes returned a different element for a stable-ID rebind.', {
      collection: label,
      expected_id: expectedId,
      actual_id: actualId,
    });
  }
  return ref;
}

function isoDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value.toISOString === 'function') {
    return value.toISOString();
  }
  var parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    fail('INVALID_DATE', 'Notes returned an invalid date.', {});
  }
  return parsed.toISOString();
}

function canonicalTimestamp(value) {
  var parsed = new Date(value);
  if (!value || isNaN(parsed.getTime())) {
    fail('INVALID_EXPECTED_MODIFIED', '--expected-modified must be an ISO 8601 timestamp.', {});
  }
  return parsed.toISOString();
}

function writeHandle(handle, value) {
  var data = $(value).dataUsingEncoding($.NSUTF8StringEncoding);
  handle.writeData(data);
}

function emit(payload, exitCode) {
  writeHandle($.NSFileHandle.fileHandleWithStandardOutput, JSON.stringify(payload) + '\n');
  if (exitCode) {
    $.exit(exitCode);
  }
}

function parseOptions(args, valueOptions, flagOptions) {
  var values = {};
  var flags = {};
  var allowedValues = {};
  var allowedFlags = {};
  var index;

  for (index = 0; index < valueOptions.length; index += 1) {
    allowedValues[valueOptions[index]] = true;
  }
  for (index = 0; index < flagOptions.length; index += 1) {
    allowedFlags[flagOptions[index]] = true;
  }

  for (index = 0; index < args.length; index += 1) {
    var token = args[index];
    if (token.slice(0, 2) !== '--') {
      fail('INVALID_ARGUMENT', 'Unexpected positional argument: ' + token, {});
    }
    var name = token.slice(2);
    if (allowedFlags[name]) {
      if (Object.prototype.hasOwnProperty.call(flags, name)) {
        fail('DUPLICATE_OPTION', 'Duplicate option: --' + name, {});
      }
      flags[name] = true;
      continue;
    }
    if (!allowedValues[name]) {
      fail('UNKNOWN_OPTION', 'Unknown option: --' + name, {});
    }
    if (Object.prototype.hasOwnProperty.call(values, name)) {
      fail('DUPLICATE_OPTION', 'Duplicate option: --' + name, {});
    }
    if (index + 1 >= args.length || args[index + 1].slice(0, 2) === '--') {
      fail('MISSING_OPTION_VALUE', 'Missing value for --' + name, {});
    }
    values[name] = args[index + 1];
    index += 1;
  }

  return { values: values, flags: flags };
}

function requireValue(parsed, name) {
  var value = parsed.values[name];
  if (value === undefined || value === '') {
    fail('MISSING_REQUIRED_OPTION', 'Missing required option: --' + name, {});
  }
  return value;
}

function optionalChoice(parsed, name, allowed, fallback) {
  var value = parsed.values[name];
  if (value === undefined) {
    return fallback;
  }
  if (allowed.indexOf(value) === -1) {
    fail('INVALID_OPTION_VALUE', '--' + name + ' must be one of: ' + allowed.join(', '), {});
  }
  return value;
}

function parsePositiveInteger(raw, optionName, maximum) {
  if (!/^[1-9][0-9]*$/.test(raw)) {
    fail('INVALID_INTEGER', '--' + optionName + ' must be a positive integer.', {});
  }
  var value = Number(raw);
  if (value > maximum) {
    fail('INTEGER_TOO_LARGE', '--' + optionName + ' cannot exceed ' + maximum + '.', {
      option: optionName,
      maximum: maximum,
    });
  }
  return value;
}

function parsedLimit(parsed) {
  if (parsed.values.limit === undefined) {
    return DEFAULT_LIMIT;
  }
  return parsePositiveInteger(parsed.values.limit, 'limit', MAX_LIMIT);
}

function parsedListScanLimit(parsed, query) {
  if (parsed.values['scan-limit'] === undefined) {
    if (query !== null) {
      fail(
        'MISSING_SCAN_LIMIT',
        'A body-query list requires an explicit --scan-limit.',
        { maximum: MAX_LIST_SCAN_LIMIT },
      );
    }
    return DEFAULT_LIST_SCAN_LIMIT;
  }
  return parsePositiveInteger(
    parsed.values['scan-limit'],
    'scan-limit',
    MAX_LIST_SCAN_LIMIT,
  );
}

function validateQuery(query) {
  if (query === undefined) {
    return null;
  }
  if (query.trim() === '') {
    fail('EMPTY_QUERY', '--query must contain visible text.', {});
  }
  if (query.length > MAX_QUERY_LENGTH) {
    fail('QUERY_TOO_LONG', '--query cannot exceed ' + MAX_QUERY_LENGTH + ' characters.', {});
  }
  return query.toLowerCase();
}

function notesApplication() {
  return Application('Notes');
}

function readStdinUtf8() {
  var handle = $.NSFileHandle.fileHandleWithStandardInput;
  var data = $.NSMutableData.data;
  var byteLength = 0;
  while (true) {
    var chunk = handle.readDataOfLength(STDIN_CHUNK_BYTES);
    var chunkLength = Number(chunk.length);
    if (chunkLength === 0) {
      break;
    }
    byteLength += chunkLength;
    if (byteLength > MAX_STDIN_BYTES) {
      fail('CONTENT_TOO_LARGE', 'stdin cannot exceed ' + MAX_STDIN_BYTES + ' bytes.', {
        bytes_read: byteLength,
        maximum: MAX_STDIN_BYTES,
      });
    }
    data.appendData(chunk);
  }
  var value = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding);
  var decoded;
  try {
    decoded = ObjC.unwrap(value);
  } catch (_error) {
    fail('INVALID_STDIN_ENCODING', 'stdin must be valid UTF-8.', {});
  }
  if (typeof decoded !== 'string') {
    fail('INVALID_STDIN_ENCODING', 'stdin must be valid UTF-8.', {});
  }
  return { text: decoded, bytes: byteLength };
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function contentContract(rawText) {
  var plaintext = rawText.replace(/\r\n|\r/g, '\n');
  var firstLine = plaintext.split('\n')[0];
  var derivedTitle = firstLine.trim();
  if (derivedTitle === '') {
    fail('CONTENT_FIRST_LINE_BLANK', 'The literal first plaintext line must contain visible text.', {});
  }
  if (derivedTitle.length > MAX_TITLE_LENGTH) {
    fail('DERIVED_TITLE_TOO_LONG', 'The literal first line cannot exceed ' + MAX_TITLE_LENGTH + ' characters.', {
      characters: derivedTitle.length,
      maximum: MAX_TITLE_LENGTH,
    });
  }
  return {
    plaintext: plaintext,
    derived_title: derivedTitle,
    html: '<div>' + escapeHtml(plaintext).replace(/\n/g, '<br>') + '</div>',
  };
}

function parseExpectedLineage(raw, optionName) {
  if (raw.length > MAX_CONTEXT_JSON_LENGTH) {
    fail('CONTEXT_TOO_LARGE', '--' + optionName + ' is too large.', {
      maximum_characters: MAX_CONTEXT_JSON_LENGTH,
    });
  }
  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    fail('INVALID_FOLDER_LINEAGE', '--' + optionName + ' must be a JSON array of stable folder IDs.', {});
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_FOLDER_DEPTH) {
    fail('INVALID_FOLDER_LINEAGE', '--' + optionName + ' must contain 1 to ' + MAX_FOLDER_DEPTH + ' IDs.', {});
  }
  for (var index = 0; index < parsed.length; index += 1) {
    if (typeof parsed[index] !== 'string' || parsed[index] === '') {
      fail('INVALID_FOLDER_LINEAGE', '--' + optionName + ' must contain only nonempty strings.', {});
    }
  }
  return parsed;
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  for (var index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function accountRecord(accountRef) {
  return {
    ref: accountRef,
    id: asString(accountRef.id()),
    name: asString(accountRef.name()),
    upgraded: asBoolean(accountRef.upgraded()),
  };
}

function publicAccount(record, defaultAccountId) {
  var result = {
    account_id: record.id,
    name: record.name,
    upgraded: record.upgraded,
  };
  if (defaultAccountId !== null) {
    result.default = record.id === defaultAccountId;
  }
  return result;
}

function scanAccountRecords(app, scanLimit) {
  var collection = app.accounts;
  var totalCandidates = collectionCount(app, collection, 'accounts');
  var scanCount = Math.min(totalCandidates, scanLimit);
  var records = [];
  for (var index = 0; index < scanCount; index += 1) {
    var accountId = indexedElementId(collection, index, 'accounts');
    records.push(accountRecord(stableElementById(collection, accountId, 'accounts')));
  }
  return {
    records: records,
    stats: {
      scanned: scanCount,
      scan_limit: scanLimit,
      scan_exhausted: totalCandidates > scanCount,
      truncated: totalCandidates > scanCount,
      total_candidates: totalCandidates,
    },
  };
}

function resolveAccount(app, accountId) {
  var scan = scanAccountRecords(app, ACCOUNT_ID_SCAN_LIMIT);
  var matches = [];
  for (var index = 0; index < scan.records.length; index += 1) {
    if (scan.records[index].id === accountId) {
      matches.push(scan.records[index]);
    }
  }
  if (scan.stats.scan_exhausted) {
    fail(
      'ACCOUNT_ID_SCAN_EXHAUSTED',
      'The bounded account ID scan ended before uniqueness could be established.',
      {
        account_id: accountId,
        scanned: scan.stats.scanned,
        scan_limit: scan.stats.scan_limit,
        total_candidates: scan.stats.total_candidates,
        matches_within_budget: matches.length,
      },
    );
  }
  if (matches.length === 0) {
    fail('ACCOUNT_NOT_FOUND', 'No Notes account matched the supplied stable ID.', {
      account_id: accountId,
      scanned: scan.stats.scanned,
      scan_exhausted: false,
    });
  }
  if (matches.length !== 1) {
    fail('AMBIGUOUS_ACCOUNT_ID', 'More than one Notes account matched the supplied stable ID.', {
      account_id: accountId,
      matches: matches.length,
      scanned: scan.stats.scanned,
    });
  }
  matches[0].resolution = scan.stats;
  return matches[0];
}

function walkFolders(app, account, scanLimit, visitor) {
  var state = {
    scanned: 0,
    scan_limit: scanLimit,
    scan_exhausted: false,
    visitor_stopped: false,
  };

  function visit(folderRef, parentContext, depth) {
    if (depth > MAX_FOLDER_DEPTH) {
      fail('FOLDER_DEPTH_EXCEEDED', 'Folder ancestry exceeds the supported depth.', {
        maximum_depth: MAX_FOLDER_DEPTH,
      });
    }
    if (state.scanned >= state.scan_limit) {
      state.scan_exhausted = true;
      return false;
    }
    state.scanned += 1;

    var id = asString(folderRef.id());
    var name = asString(folderRef.name());
    var directlyShared = asBoolean(folderRef.shared());
    var pathComponents = parentContext ? parentContext.path_components.slice() : [];
    var lineageIds = parentContext ? parentContext.lineage_ids.slice() : [];
    var lineageRefs = parentContext ? parentContext.lineage_refs.slice() : [];
    pathComponents.push(name);
    lineageIds.push(id);
    lineageRefs.push(folderRef);

    var context = {
      ref: folderRef,
      id: id,
      name: name,
      account_ref: account.ref,
      account_id: account.id,
      account_name: account.name,
      parent_folder_id: parentContext ? parentContext.id : null,
      path_components: pathComponents,
      path: pathComponents.join('/'),
      lineage_ids: lineageIds,
      lineage_refs: lineageRefs,
      directly_shared: directlyShared,
      shared: directlyShared || (parentContext ? parentContext.shared : false),
    };

    if (visitor(context) === false) {
      state.visitor_stopped = true;
      return false;
    }

    var children = folderRef.folders;
    var childCount = collectionCount(app, children, 'folders');
    for (var childIndex = 0; childIndex < childCount; childIndex += 1) {
      var childId = indexedElementId(children, childIndex, 'folders');
      var childRef = stableElementById(children, childId, 'folders');
      if (visit(childRef, context, depth + 1) === false) {
        return false;
      }
    }
    return true;
  }

  var roots = account.ref.folders;
  var rootCount = collectionCount(app, roots, 'folders');
  for (var rootIndex = 0; rootIndex < rootCount; rootIndex += 1) {
    var rootId = indexedElementId(roots, rootIndex, 'folders');
    var rootRef = stableElementById(roots, rootId, 'folders');
    if (visit(rootRef, null, 1) === false) {
      break;
    }
  }
  return state;
}

function publicFolder(context) {
  return {
    folder_id: context.id,
    name: context.name,
    account_id: context.account_id,
    account_name: context.account_name,
    parent_folder_id: context.parent_folder_id,
    folder_lineage_ids: context.lineage_ids,
    path_components: context.path_components,
    path: context.path,
    directly_shared: context.directly_shared,
    shared: context.shared,
  };
}

function resolveFolder(app, folderId) {
  var accountScan = scanAccountRecords(app, ACCOUNT_ID_SCAN_LIMIT);
  if (accountScan.stats.scan_exhausted) {
    fail(
      'ACCOUNT_ID_SCAN_EXHAUSTED',
      'Folder resolution cannot continue because the bounded account scan was exhausted.',
      {
        folder_id: folderId,
        accounts_scanned: accountScan.stats.scanned,
        account_scan_limit: accountScan.stats.scan_limit,
        total_accounts: accountScan.stats.total_candidates,
      },
    );
  }

  var matches = [];
  var foldersScanned = 0;
  var folderScanExhausted = false;
  for (var accountIndex = 0; accountIndex < accountScan.records.length; accountIndex += 1) {
    var remaining = FOLDER_ID_SCAN_LIMIT - foldersScanned;
    var folderScan = walkFolders(app, accountScan.records[accountIndex], remaining, function (context) {
      if (context.id === folderId) {
        matches.push(context);
      }
      return true;
    });
    foldersScanned += folderScan.scanned;
    if (folderScan.scan_exhausted) {
      folderScanExhausted = true;
      break;
    }
  }

  var resolution = {
    accounts_scanned: accountScan.stats.scanned,
    account_scan_limit: ACCOUNT_ID_SCAN_LIMIT,
    folders_scanned: foldersScanned,
    folder_scan_limit: FOLDER_ID_SCAN_LIMIT,
    scan_exhausted: folderScanExhausted,
    truncated: folderScanExhausted,
  };
  if (folderScanExhausted) {
    fail(
      'FOLDER_ID_SCAN_EXHAUSTED',
      'The bounded folder ID scan ended before uniqueness could be established.',
      {
        folder_id: folderId,
        accounts_scanned: resolution.accounts_scanned,
        folders_scanned: resolution.folders_scanned,
        folder_scan_limit: resolution.folder_scan_limit,
        matches_within_budget: matches.length,
      },
    );
  }
  if (matches.length === 0) {
    fail('FOLDER_NOT_FOUND', 'No Notes folder matched the supplied stable ID.', {
      folder_id: folderId,
      accounts_scanned: resolution.accounts_scanned,
      folders_scanned: resolution.folders_scanned,
      scan_exhausted: false,
    });
  }
  if (matches.length !== 1) {
    fail('AMBIGUOUS_FOLDER_ID', 'More than one Notes folder matched the supplied stable ID.', {
      folder_id: folderId,
      matches: matches.length,
      folders_scanned: resolution.folders_scanned,
    });
  }
  matches[0].resolution = resolution;
  return matches[0];
}

function resolveNote(app, noteId) {
  var collection = app.notes;
  var totalCandidates = collectionCount(app, collection, 'notes');
  var scanCount = Math.min(totalCandidates, NOTE_ID_SCAN_LIMIT);
  var matches = [];
  for (var index = 0; index < scanCount; index += 1) {
    var candidateId = indexedElementId(collection, index, 'notes');
    if (candidateId === noteId) {
      matches.push(stableElementById(collection, candidateId, 'notes'));
    }
  }
  var resolution = {
    scanned: scanCount,
    scan_limit: NOTE_ID_SCAN_LIMIT,
    scan_exhausted: totalCandidates > scanCount,
    truncated: totalCandidates > scanCount,
    total_candidates: totalCandidates,
  };
  if (resolution.scan_exhausted) {
    fail(
      'NOTE_ID_SCAN_EXHAUSTED',
      'The bounded note ID scan ended before uniqueness could be established.',
      {
        note_id: noteId,
        scanned: resolution.scanned,
        scan_limit: resolution.scan_limit,
        total_candidates: resolution.total_candidates,
        matches_within_budget: matches.length,
      },
    );
  }
  if (matches.length === 0) {
    fail('NOTE_NOT_FOUND', 'No note matched the supplied stable ID.', {
      note_id: noteId,
      scanned: resolution.scanned,
      scan_exhausted: false,
    });
  }
  if (matches.length !== 1) {
    fail('AMBIGUOUS_NOTE_ID', 'More than one note matched the supplied stable ID.', {
      note_id: noteId,
      matches: matches.length,
      scanned: resolution.scanned,
    });
  }
  return { ref: matches[0], id: noteId, resolution: resolution };
}

function folderContextForNote(app, noteRef) {
  return resolveFolder(app, asString(noteRef.container().id()));
}

function noteIsLocked(noteRef) {
  return asBoolean(noteRef.passwordProtected());
}

function attachmentCount(app, noteRef) {
  return collectionCount(app, noteRef.attachments, 'attachments');
}

function currentEffectiveFolderShared(folderContext) {
  for (var index = 0; index < folderContext.lineage_refs.length; index += 1) {
    if (asBoolean(folderContext.lineage_refs[index].shared())) {
      return true;
    }
  }
  return false;
}

function assertFolderContextUnchanged(folderContext) {
  for (var index = 0; index < folderContext.lineage_refs.length; index += 1) {
    var folderRef = folderContext.lineage_refs[index];
    if (asString(folderRef.id()) !== folderContext.lineage_ids[index]) {
      fail('FOLDER_CONTEXT_CHANGED', 'A folder ID changed after resolution.', {
        expected_folder_id: folderContext.lineage_ids[index],
        current_folder_id: asString(folderRef.id()),
      });
    }
    var expectedContainerId =
      index === 0 ? folderContext.account_id : folderContext.lineage_ids[index - 1];
    var currentContainerId = asString(folderRef.container().id());
    if (currentContainerId !== expectedContainerId) {
      fail('FOLDER_CONTEXT_CHANGED', 'A folder moved after resolution.', {
        folder_id: folderContext.lineage_ids[index],
        expected_container_id: expectedContainerId,
        current_container_id: currentContainerId,
      });
    }
  }
}

function assertExpectedFolderContext(folderContext, expectedAccountId, expectedLineage) {
  if (
    folderContext.account_id !== expectedAccountId ||
    !arraysEqual(folderContext.lineage_ids, expectedLineage)
  ) {
    fail(
      'PREVIEW_CONTEXT_CHANGED',
      'The current account or folder ancestry differs from the confirmed preview.',
      {
        expected_account_id: expectedAccountId,
        current_account_id: folderContext.account_id,
        expected_folder_lineage_ids: expectedLineage,
        current_folder_lineage_ids: folderContext.lineage_ids,
      },
    );
  }
}

function noteMetadata(app, noteRef, folderContext) {
  var noteShared = asBoolean(noteRef.shared());
  var folderShared = currentEffectiveFolderShared(folderContext);
  return {
    note_id: asString(noteRef.id()),
    title: asString(noteRef.name()),
    account_id: folderContext.account_id,
    account_name: folderContext.account_name,
    folder_id: folderContext.id,
    folder_name: folderContext.name,
    folder_lineage_ids: folderContext.lineage_ids,
    folder_path_components: folderContext.path_components,
    folder_path: folderContext.path,
    created: isoDate(noteRef.creationDate()),
    modified: isoDate(noteRef.modificationDate()),
    attachment_count: attachmentCount(app, noteRef),
    note_shared: noteShared,
    folder_shared: folderShared,
    shared_impact: noteShared || folderShared,
    locked: false,
  };
}

function assertUnlocked(noteRef, noteId) {
  if (noteIsLocked(noteRef)) {
    fail('LOCKED_NOTE', 'Locked notes are outside this bridge surface.', { note_id: noteId });
  }
}

function assertContainerUnchanged(noteRef, expectedFolderId) {
  var currentFolderId = asString(noteRef.container().id());
  if (currentFolderId !== expectedFolderId) {
    fail('NOTE_CONTAINER_CHANGED', 'The note moved after it was resolved; resolve it again.', {
      expected_folder_id: expectedFolderId,
      current_folder_id: currentFolderId,
    });
  }
}

function assertExpectedModified(noteRef, expectedModified) {
  var expected = canonicalTimestamp(expectedModified);
  var current = isoDate(noteRef.modificationDate());
  if (current !== expected) {
    fail('MODIFICATION_CONFLICT', 'The note changed after it was previewed; resolve and confirm again.', {
      expected_modified: expected,
      current_modified: current,
    });
  }
  return current;
}

function assertSharedConfirmation(required, parsed, details) {
  if (required && !parsed.flags['confirm-shared']) {
    fail(
      'SHARED_CONFIRMATION_REQUIRED',
      'This operation affects a shared note or folder. Reconfirm the external impact, then pass --confirm-shared.',
      details,
    );
  }
}

function assertDerivedTitle(noteRef, expectedTitle, operation) {
  var actualTitle = asString(noteRef.name());
  if (actualTitle !== expectedTitle) {
    fail(
      'TITLE_VERIFICATION_FAILED',
      'Notes did not report the title derived from the confirmed first plaintext line.',
      {
        operation: operation,
        note_id: asString(noteRef.id()),
        expected_title: expectedTitle,
        actual_title: actualTitle,
        mutation_may_have_completed: true,
        retry: false,
      },
    );
  }
  return actualTitle;
}

function expectedSourceContext(parsed) {
  return {
    account_id: requireValue(parsed, 'expected-account-id'),
    lineage_ids: parseExpectedLineage(
      requireValue(parsed, 'expected-folder-lineage-json'),
      'expected-folder-lineage-json',
    ),
  };
}

function expectedDestinationContext(parsed) {
  return {
    account_id: requireValue(parsed, 'expected-destination-account-id'),
    lineage_ids: parseExpectedLineage(
      requireValue(parsed, 'expected-destination-lineage-json'),
      'expected-destination-lineage-json',
    ),
  };
}

function accountsCommand(args) {
  var parsed = parseOptions(args, ['limit'], []);
  var limit = parsedLimit(parsed);
  var app = notesApplication();
  var collection = app.accounts;
  var totalCandidates = collectionCount(app, collection, 'accounts');
  var scanCount = Math.min(totalCandidates, limit, ACCOUNT_ID_SCAN_LIMIT);
  var defaultAccountId = null;
  try {
    defaultAccountId = asString(app.defaultAccount().id());
  } catch (_error) {
    defaultAccountId = null;
  }
  var items = [];
  for (var index = 0; index < scanCount; index += 1) {
    var accountId = indexedElementId(collection, index, 'accounts');
    var accountRef = stableElementById(collection, accountId, 'accounts');
    items.push(publicAccount(accountRecord(accountRef), defaultAccountId));
  }
  var scanExhausted =
    totalCandidates > scanCount && scanCount === ACCOUNT_ID_SCAN_LIMIT && limit >= ACCOUNT_ID_SCAN_LIMIT;
  return {
    items: items,
    returned: items.length,
    truncated: totalCandidates > scanCount,
    limit: limit,
    scan: {
      scanned: scanCount,
      scan_limit: ACCOUNT_ID_SCAN_LIMIT,
      scan_exhausted: scanExhausted,
      total_candidates: totalCandidates,
    },
  };
}

function foldersCommand(args) {
  var parsed = parseOptions(args, ['account-id', 'limit'], []);
  var accountId = requireValue(parsed, 'account-id');
  var limit = parsedLimit(parsed);
  var app = notesApplication();
  var account = resolveAccount(app, accountId);
  var items = [];
  var outputTruncated = false;
  var folderScan = walkFolders(app, account, FOLDER_ID_SCAN_LIMIT, function (context) {
    if (items.length >= limit) {
      outputTruncated = true;
      return false;
    }
    items.push(publicFolder(context));
    return true;
  });

  return {
    account: publicAccount(account, null),
    items: items,
    returned: items.length,
    truncated: outputTruncated || folderScan.scan_exhausted,
    limit: limit,
    scan: {
      account_resolution: account.resolution,
      folders_scanned: folderScan.scanned,
      folder_scan_limit: folderScan.scan_limit,
      scan_exhausted: folderScan.scan_exhausted,
      stopped_for_output_limit: outputTruncated,
    },
  };
}

function listCommand(args) {
  var parsed = parseOptions(args, ['folder-id', 'query', 'limit', 'scan-limit'], []);
  var folderId = requireValue(parsed, 'folder-id');
  var query = validateQuery(parsed.values.query);
  var limit = parsedLimit(parsed);
  var scanLimit = parsedListScanLimit(parsed, query);
  var app = notesApplication();
  var folder = resolveFolder(app, folderId);
  var collection = folder.ref.notes;
  var totalCandidates = collectionCount(app, collection, 'notes');
  var items = [];
  var skippedLocked = 0;
  var scanned = 0;
  var bodiesScanned = 0;
  var outputTruncated = false;

  for (var index = 0; index < totalCandidates && scanned < scanLimit; index += 1) {
    var candidateId = indexedElementId(collection, index, 'notes');
    var noteRef = stableElementById(collection, candidateId, 'notes');
    scanned += 1;
    if (noteIsLocked(noteRef)) {
      skippedLocked += 1;
      continue;
    }

    if (query !== null) {
      var titleMatch = asString(noteRef.name()).toLowerCase().indexOf(query) !== -1;
      var bodyMatch = false;
      if (!titleMatch) {
        bodiesScanned += 1;
        bodyMatch = asString(noteRef.plaintext()).toLowerCase().indexOf(query) !== -1;
      }
      if (!titleMatch && !bodyMatch) {
        continue;
      }
    }

    if (items.length >= limit) {
      outputTruncated = true;
      break;
    }
    items.push(noteMetadata(app, noteRef, folder));
  }

  var scanExhausted = !outputTruncated && scanned >= scanLimit && totalCandidates > scanned;
  return {
    folder: publicFolder(folder),
    query: parsed.values.query === undefined ? null : parsed.values.query,
    items: items,
    returned: items.length,
    skipped_locked: skippedLocked,
    truncated: outputTruncated || scanExhausted,
    limit: limit,
    scan: {
      folder_resolution: folder.resolution,
      notes_scanned: scanned,
      bodies_scanned: bodiesScanned,
      scan_limit: scanLimit,
      scan_exhausted: scanExhausted,
      stopped_for_output_limit: outputTruncated,
      total_candidates: totalCandidates,
    },
  };
}

function getCommand(args) {
  var parsed = parseOptions(args, ['note-id', 'format'], []);
  var noteId = requireValue(parsed, 'note-id');
  var format = optionalChoice(parsed, 'format', ['plaintext', 'html'], 'plaintext');
  var app = notesApplication();
  var note = resolveNote(app, noteId);
  assertUnlocked(note.ref, note.id);
  var folder = folderContextForNote(app, note.ref);
  assertFolderContextUnchanged(folder);
  assertContainerUnchanged(note.ref, folder.id);
  var metadata = noteMetadata(app, note.ref, folder);
  metadata.format = format;
  metadata.content = format === 'html' ? asString(note.ref.body()) : asString(note.ref.plaintext());
  metadata.scan = {
    note_resolution: note.resolution,
    folder_resolution: folder.resolution,
  };
  return metadata;
}

function contentInfoCommand(args) {
  parseOptions(args, [], []);
  var input = readStdinUtf8();
  var contract = contentContract(input.text);
  return {
    derived_title: contract.derived_title,
    input_bytes: input.bytes,
    normalized_characters: contract.plaintext.length,
    touches_notes_data: false,
  };
}

function createCommand(args) {
  var parsed = parseOptions(
    args,
    ['folder-id', 'expected-account-id', 'expected-folder-lineage-json'],
    ['confirm-shared'],
  );
  var folderId = requireValue(parsed, 'folder-id');
  var expected = expectedSourceContext(parsed);
  var input = readStdinUtf8();
  var contract = contentContract(input.text);
  var app = notesApplication();
  var folder = resolveFolder(app, folderId);

  assertExpectedFolderContext(folder, expected.account_id, expected.lineage_ids);
  assertFolderContextUnchanged(folder);
  var folderShared = currentEffectiveFolderShared(folder);
  assertSharedConfirmation(folderShared, parsed, {
    destination_account_id: folder.account_id,
    destination_folder_id: folder.id,
    destination_folder_lineage_ids: folder.lineage_ids,
    destination_folder_shared: folderShared,
    impact: 'The new note may become visible to collaborators immediately.',
  });
  assertFolderContextUnchanged(folder);
  folderShared = currentEffectiveFolderShared(folder);
  assertSharedConfirmation(folderShared, parsed, {
    destination_account_id: folder.account_id,
    destination_folder_id: folder.id,
    destination_folder_lineage_ids: folder.lineage_ids,
    destination_folder_shared: folderShared,
    impact: 'The new note may become visible to collaborators immediately.',
  });

  var created = app.Note({ name: contract.derived_title, body: contract.html });
  folder.ref.notes.push(created);
  assertDerivedTitle(created, contract.derived_title, 'create');
  var result = noteMetadata(app, created, folder);
  result.derived_title = contract.derived_title;
  result.title_matches_derived = true;
  result.scan = { destination_folder_resolution: folder.resolution };
  return result;
}

function updateCommand(args) {
  var parsed = parseOptions(
    args,
    [
      'note-id',
      'expected-modified',
      'expected-account-id',
      'expected-folder-lineage-json',
    ],
    ['confirm-shared'],
  );
  var noteId = requireValue(parsed, 'note-id');
  var expectedModified = requireValue(parsed, 'expected-modified');
  var expected = expectedSourceContext(parsed);
  var input = readStdinUtf8();
  var contract = contentContract(input.text);
  var app = notesApplication();

  var initialNote = resolveNote(app, noteId);
  assertUnlocked(initialNote.ref, initialNote.id);
  var initialFolder = folderContextForNote(app, initialNote.ref);
  assertExpectedFolderContext(initialFolder, expected.account_id, expected.lineage_ids);
  assertContainerUnchanged(initialNote.ref, initialFolder.id);
  var initialAttachmentCount = attachmentCount(app, initialNote.ref);
  if (initialAttachmentCount !== 0) {
    fail('ATTACHMENTS_PRESENT', 'Updates are blocked when a note has attachments.', {
      note_id: noteId,
      attachment_count: initialAttachmentCount,
    });
  }

  var writeNote = resolveNote(app, noteId);
  assertUnlocked(writeNote.ref, writeNote.id);
  var writeFolder = folderContextForNote(app, writeNote.ref);
  assertExpectedFolderContext(writeFolder, expected.account_id, expected.lineage_ids);
  assertFolderContextUnchanged(writeFolder);
  assertContainerUnchanged(writeNote.ref, writeFolder.id);
  var currentAttachmentCount = attachmentCount(app, writeNote.ref);
  if (currentAttachmentCount !== 0) {
    fail('ATTACHMENTS_CHANGED', 'The note gained attachments after preview; resolve it again.', {
      note_id: noteId,
      attachment_count: currentAttachmentCount,
    });
  }
  var noteShared = asBoolean(writeNote.ref.shared());
  var folderShared = currentEffectiveFolderShared(writeFolder);
  assertSharedConfirmation(noteShared || folderShared, parsed, {
    note_id: noteId,
    note_shared: noteShared,
    folder_shared: folderShared,
    impact: 'Replacing the complete content, including a possible title change, may sync immediately.',
  });
  assertFolderContextUnchanged(writeFolder);
  noteShared = asBoolean(writeNote.ref.shared());
  folderShared = currentEffectiveFolderShared(writeFolder);
  assertSharedConfirmation(noteShared || folderShared, parsed, {
    note_id: noteId,
    note_shared: noteShared,
    folder_shared: folderShared,
    impact: 'Replacing the complete content, including a possible title change, may sync immediately.',
  });
  assertUnlocked(writeNote.ref, writeNote.id);
  assertContainerUnchanged(writeNote.ref, writeFolder.id);
  assertExpectedModified(writeNote.ref, expectedModified);

  writeNote.ref.body = contract.html;
  assertDerivedTitle(writeNote.ref, contract.derived_title, 'update');
  var result = noteMetadata(app, writeNote.ref, writeFolder);
  result.derived_title = contract.derived_title;
  result.title_matches_derived = true;
  result.update_may_rename = true;
  result.scan = {
    initial_note_resolution: initialNote.resolution,
    initial_folder_resolution: initialFolder.resolution,
    write_note_resolution: writeNote.resolution,
    write_folder_resolution: writeFolder.resolution,
  };
  return result;
}

function moveCommand(args) {
  var parsed = parseOptions(
    args,
    [
      'note-id',
      'folder-id',
      'expected-modified',
      'expected-account-id',
      'expected-folder-lineage-json',
      'expected-destination-account-id',
      'expected-destination-lineage-json',
    ],
    ['confirm-shared'],
  );
  var noteId = requireValue(parsed, 'note-id');
  var destinationFolderId = requireValue(parsed, 'folder-id');
  var expectedModified = requireValue(parsed, 'expected-modified');
  var expectedSource = expectedSourceContext(parsed);
  var expectedDestination = expectedDestinationContext(parsed);
  var app = notesApplication();

  var initialNote = resolveNote(app, noteId);
  assertUnlocked(initialNote.ref, initialNote.id);
  var initialSource = folderContextForNote(app, initialNote.ref);
  var initialDestination = resolveFolder(app, destinationFolderId);
  assertExpectedFolderContext(
    initialSource,
    expectedSource.account_id,
    expectedSource.lineage_ids,
  );
  assertExpectedFolderContext(
    initialDestination,
    expectedDestination.account_id,
    expectedDestination.lineage_ids,
  );
  if (initialSource.account_id !== initialDestination.account_id) {
    fail('CROSS_ACCOUNT_MOVE_UNSUPPORTED', 'Cross-account moves are outside this bridge surface.', {
      source_account_id: initialSource.account_id,
      destination_account_id: initialDestination.account_id,
    });
  }
  if (initialSource.id === initialDestination.id) {
    fail('SAME_FOLDER', 'The note is already in the requested destination folder.', {
      folder_id: initialSource.id,
    });
  }

  var writeNote = resolveNote(app, noteId);
  assertUnlocked(writeNote.ref, writeNote.id);
  var writeSource = folderContextForNote(app, writeNote.ref);
  var writeDestination = resolveFolder(app, destinationFolderId);
  assertExpectedFolderContext(writeSource, expectedSource.account_id, expectedSource.lineage_ids);
  assertExpectedFolderContext(
    writeDestination,
    expectedDestination.account_id,
    expectedDestination.lineage_ids,
  );
  if (writeSource.account_id !== writeDestination.account_id) {
    fail('CROSS_ACCOUNT_MOVE_UNSUPPORTED', 'Cross-account moves are outside this bridge surface.', {
      source_account_id: writeSource.account_id,
      destination_account_id: writeDestination.account_id,
    });
  }
  assertFolderContextUnchanged(writeSource);
  assertFolderContextUnchanged(writeDestination);
  assertContainerUnchanged(writeNote.ref, writeSource.id);
  var noteShared = asBoolean(writeNote.ref.shared());
  var sourceShared = currentEffectiveFolderShared(writeSource);
  var destinationShared = currentEffectiveFolderShared(writeDestination);
  assertSharedConfirmation(noteShared || sourceShared || destinationShared, parsed, {
    note_id: noteId,
    note_shared: noteShared,
    source_folder_shared: sourceShared,
    destination_folder_shared: destinationShared,
    impact: 'Moving may remove collaborator access, expose the note, or sync a location change.',
  });
  assertFolderContextUnchanged(writeSource);
  assertFolderContextUnchanged(writeDestination);
  noteShared = asBoolean(writeNote.ref.shared());
  sourceShared = currentEffectiveFolderShared(writeSource);
  destinationShared = currentEffectiveFolderShared(writeDestination);
  assertSharedConfirmation(noteShared || sourceShared || destinationShared, parsed, {
    note_id: noteId,
    note_shared: noteShared,
    source_folder_shared: sourceShared,
    destination_folder_shared: destinationShared,
    impact: 'Moving may remove collaborator access, expose the note, or sync a location change.',
  });
  assertUnlocked(writeNote.ref, writeNote.id);
  assertContainerUnchanged(writeNote.ref, writeSource.id);
  assertExpectedModified(writeNote.ref, expectedModified);

  app.move(writeNote.ref, { to: writeDestination.ref });
  var actualFolderId = asString(writeNote.ref.container().id());
  if (actualFolderId !== writeDestination.id) {
    fail('MOVE_VERIFICATION_FAILED', 'Notes did not report the expected destination after the native move.', {
      note_id: noteId,
      expected_folder_id: writeDestination.id,
      actual_folder_id: actualFolderId,
      retry: false,
    });
  }
  var result = noteMetadata(app, writeNote.ref, writeDestination);
  result.source = publicFolder(writeSource);
  result.destination = publicFolder(writeDestination);
  result.scan = {
    initial_note_resolution: initialNote.resolution,
    initial_source_folder_resolution: initialSource.resolution,
    initial_destination_folder_resolution: initialDestination.resolution,
    write_note_resolution: writeNote.resolution,
    write_source_folder_resolution: writeSource.resolution,
    write_destination_folder_resolution: writeDestination.resolution,
  };
  return result;
}

function deleteCommand(args) {
  var parsed = parseOptions(
    args,
    [
      'note-id',
      'expected-modified',
      'expected-account-id',
      'expected-folder-lineage-json',
    ],
    ['confirm-delete', 'confirm-shared'],
  );
  var noteId = requireValue(parsed, 'note-id');
  var expectedModified = requireValue(parsed, 'expected-modified');
  var expected = expectedSourceContext(parsed);
  if (!parsed.flags['confirm-delete']) {
    fail(
      'DELETE_CONFIRMATION_REQUIRED',
      'Deletion requires a fresh user reconfirmation and the --confirm-delete flag.',
      { note_id: noteId },
    );
  }
  var app = notesApplication();

  var initialNote = resolveNote(app, noteId);
  assertUnlocked(initialNote.ref, initialNote.id);
  var initialFolder = folderContextForNote(app, initialNote.ref);
  assertExpectedFolderContext(initialFolder, expected.account_id, expected.lineage_ids);
  assertFolderContextUnchanged(initialFolder);
  assertContainerUnchanged(initialNote.ref, initialFolder.id);
  var metadata = noteMetadata(app, initialNote.ref, initialFolder);

  var deleteNote = resolveNote(app, noteId);
  assertUnlocked(deleteNote.ref, deleteNote.id);
  var deleteFolder = folderContextForNote(app, deleteNote.ref);
  assertExpectedFolderContext(deleteFolder, expected.account_id, expected.lineage_ids);
  assertFolderContextUnchanged(deleteFolder);
  assertContainerUnchanged(deleteNote.ref, deleteFolder.id);
  var noteShared = asBoolean(deleteNote.ref.shared());
  var folderShared = currentEffectiveFolderShared(deleteFolder);
  assertSharedConfirmation(noteShared || folderShared, parsed, {
    note_id: noteId,
    note_shared: noteShared,
    folder_shared: folderShared,
    impact: 'Deleting may remove the note for collaborators and sync the deletion.',
  });
  assertFolderContextUnchanged(deleteFolder);
  noteShared = asBoolean(deleteNote.ref.shared());
  folderShared = currentEffectiveFolderShared(deleteFolder);
  assertSharedConfirmation(noteShared || folderShared, parsed, {
    note_id: noteId,
    note_shared: noteShared,
    folder_shared: folderShared,
    impact: 'Deleting may remove the note for collaborators and sync the deletion.',
  });
  assertUnlocked(deleteNote.ref, deleteNote.id);
  assertContainerUnchanged(deleteNote.ref, deleteFolder.id);
  assertExpectedModified(deleteNote.ref, expectedModified);

  app.delete(deleteNote.ref);
  return {
    delete_requested: true,
    note: metadata,
    recovery_guaranteed: false,
    retry: false,
    scan: {
      initial_note_resolution: initialNote.resolution,
      initial_folder_resolution: initialFolder.resolution,
      delete_note_resolution: deleteNote.resolution,
      delete_folder_resolution: deleteFolder.resolution,
    },
  };
}

function helpCommand() {
  return {
    invocation: '/usr/bin/osascript -l JavaScript notes_bridge.js <command> [options]',
    commands: {
      accounts: ['--limit'],
      folders: ['--account-id', '--limit'],
      list: ['--folder-id', '--query', '--limit', '--scan-limit'],
      get: ['--note-id', '--format plaintext|html'],
      'content-info': ['complete plaintext via stdin'],
      create: [
        '--folder-id',
        '--expected-account-id',
        '--expected-folder-lineage-json',
        '--confirm-shared',
        'complete plaintext via stdin',
      ],
      update: [
        '--note-id',
        '--expected-modified',
        '--expected-account-id',
        '--expected-folder-lineage-json',
        '--confirm-shared',
        'complete plaintext via stdin',
      ],
      move: [
        '--note-id',
        '--folder-id',
        '--expected-modified',
        '--expected-account-id',
        '--expected-folder-lineage-json',
        '--expected-destination-account-id',
        '--expected-destination-lineage-json',
        '--confirm-shared',
      ],
      delete: [
        '--note-id',
        '--expected-modified',
        '--expected-account-id',
        '--expected-folder-lineage-json',
        '--confirm-delete',
        '--confirm-shared',
      ],
      'self-test': [],
    },
    scan_limits: {
      account_id_resolution: ACCOUNT_ID_SCAN_LIMIT,
      folder_id_resolution: FOLDER_ID_SCAN_LIMIT,
      note_id_resolution: NOTE_ID_SCAN_LIMIT,
      list_default: DEFAULT_LIST_SCAN_LIMIT,
      list_maximum: MAX_LIST_SCAN_LIMIT,
    },
    notes: [
      'create and update accept complete plaintext only through stdin',
      'stdin is capped while streaming at 10 MiB',
      'the literal first plaintext line is the derived title and updates may rename the note',
      'HTML is read-only',
      'cross-account moves and filesystem writes are unsupported',
      'logical errors return JSON with ok=false and a nonzero exit status',
      'locked notes are skipped or rejected',
    ],
  };
}

function selfTestCommand() {
  var assertions = [];

  function assertEqual(name, actual, expected) {
    if (actual !== expected) {
      fail('SELF_TEST_FAILED', name + ' failed.', { actual: actual, expected: expected });
    }
    assertions.push(name);
  }

  var mockApp = { count: function (_collection) { return 3; } };
  assertEqual('collection count', collectionCount(mockApp, {}, 'mock'), 3);
  var mockRef = { id: function () { return 'stable-id'; } };
  var mockCollection = {
    0: mockRef,
    byId: function (_id) { return mockRef; },
  };
  assertEqual('indexed candidate ID', indexedElementId(mockCollection, 0, 'mock'), 'stable-id');
  assertEqual(
    'stable ID rebind',
    asString(stableElementById(mockCollection, 'stable-id', 'mock').id()),
    'stable-id',
  );
  var rejectedMismatchedRebind = false;
  try {
    stableElementById(
      { byId: function (_id) { return { id: function () { return 'different-id'; } }; } },
      'stable-id',
      'mock',
    );
  } catch (error) {
    rejectedMismatchedRebind = error.bridgeCode === 'ID_REBIND_FAILED';
  }
  assertEqual('mismatched ID rebind rejection', rejectedMismatchedRebind, true);
  assertEqual('html escaping', escapeHtml('<&>"\''), '&lt;&amp;&gt;&quot;&#39;');
  var contract = contentContract('  Project Atlas  \rNext <step>');
  assertEqual('derived title', contract.derived_title, 'Project Atlas');
  assertEqual('newline normalization', contract.plaintext, '  Project Atlas  \nNext <step>');
  assertEqual(
    'plaintext conversion',
    contract.html,
    '<div>  Project Atlas  <br>Next &lt;step&gt;</div>',
  );
  var rejectedBlankFirstLine = false;
  try {
    contentContract('\nProject Atlas');
  } catch (error) {
    rejectedBlankFirstLine = error.bridgeCode === 'CONTENT_FIRST_LINE_BLANK';
  }
  assertEqual('blank first line rejection', rejectedBlankFirstLine, true);
  assertEqual(
    'timestamp canonicalization',
    canonicalTimestamp('2026-08-14T12:00:00-04:00'),
    '2026-08-14T16:00:00.000Z',
  );
  var lineage = parseExpectedLineage('["folder-a","folder-b"]', 'test-lineage');
  assertEqual('lineage length', lineage.length, 2);
  assertEqual('lineage value', lineage[1], 'folder-b');
  var parsed = parseOptions(
    ['--query', 'atlas', '--scan-limit', '25'],
    ['query', 'scan-limit'],
    [],
  );
  assertEqual('explicit list scan budget', parsedListScanLimit(parsed, 'atlas'), 25);

  return { passed: assertions.length, assertions: assertions, touches_notes_data: false };
}

function dispatch(argv) {
  if (!argv || argv.length === 0 || argv[0] === 'help' || argv[0] === '--help') {
    return helpCommand();
  }
  var command = argv[0];
  var args = argv.slice(1);
  if (command === 'accounts') return accountsCommand(args);
  if (command === 'folders') return foldersCommand(args);
  if (command === 'list') return listCommand(args);
  if (command === 'get') return getCommand(args);
  if (command === 'content-info') return contentInfoCommand(args);
  if (command === 'create') return createCommand(args);
  if (command === 'update') return updateCommand(args);
  if (command === 'move') return moveCommand(args);
  if (command === 'delete') return deleteCommand(args);
  if (command === 'self-test') return selfTestCommand();
  fail('UNKNOWN_COMMAND', 'Unknown command: ' + command, {});
}

function run(argv) {
  try {
    emit({ ok: true, data: dispatch(argv) }, 0);
  } catch (error) {
    emit(
      {
        ok: false,
        error: {
          code: error.bridgeCode || 'UNEXPECTED_ERROR',
          message: error.message || asString(error),
          details: error.bridgeDetails || {},
        },
      },
      1,
    );
  }
}
