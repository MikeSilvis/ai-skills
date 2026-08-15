# Apple Contacts command reference

Use these recipes from a macOS shell. They call the public AppleScript dictionary shipped with Contacts and pass user-controlled values through `argv` rather than embedding them in source.

## Preflight and permissions

Run the non-data preflight first:

```bash
uname -s
command -v osascript
test -d /System/Applications/Contacts.app
sdef /System/Applications/Contacts.app >/dev/null
```

The first real command may cause macOS to ask whether the host app may control Contacts. If access is denied, have the user open **System Settings > Privacy & Security > Automation**, find the terminal or agent host, and enable Contacts. A denial commonly appears as Apple Event error `-1743` or privilege error `-10004`.

Do not request Full Disk Access. Do not run `tccutil reset` unless the user explicitly wants to reset a permission grant; it affects more than the current command and forces prompts to recur.

User data passed as command-line arguments may be briefly visible to other processes owned by the same user. Avoid putting especially sensitive notes or full contact exports in arguments when a narrower field-level operation is possible.

## Find candidates with minimal fields

Pass a nonblank name fragment and a maximum result count. Keep the maximum between 1 and 25.

```bash
osascript - "Casey" 10 <<'APPLESCRIPT'
on containsVisibleText(inputText)
  repeat with characterValue in characters of inputText
    set characterText to characterValue as text
    if characterText is not space and characterText is not tab and characterText is not return and characterText is not linefeed then return true
  end repeat
  return false
end containsVisibleText

on recordSafe(inputText)
  set fieldText to inputText as text
  if fieldText contains tab or fieldText contains return or fieldText contains linefeed then error "Contact metadata contains a record delimiter; use visible Contacts UI instead"
  return fieldText
end recordSafe

on run argv
  set queryText to item 1 of argv
  set maximumResults to item 2 of argv as integer
  if not my containsVisibleText(queryText) then error "Contact search cannot be blank"
  if maximumResults < 1 or maximumResults > 25 then error "Maximum results must be between 1 and 25"
  tell application "Contacts"
    set matches to every person whose name contains queryText
    set rows to {}
    repeat with contactRecord in matches
      set organizationText to organization of contactRecord
      if organizationText is missing value then set organizationText to ""
      set end of rows to (id of contactRecord as text) & tab & my recordSafe(name of contactRecord) & tab & my recordSafe(organizationText)
      if (count rows) is greater than or equal to maximumResults then exit repeat
    end repeat
  end tell
  set previousDelimiters to AppleScript's text item delimiters
  set AppleScript's text item delimiters to linefeed
  set outputText to rows as text
  set AppleScript's text item delimiters to previousDelimiters
  return outputText
end run
APPLESCRIPT
```

If multiple rows match, do not continue until the user selects one. Fetch only the extra field needed for disambiguation.

## Read one resolved contact

Use the stable Contacts ID, not the display name. Pass `basic`, `emails`, or `phones` so the command reads only the requested field set:

```bash
osascript - "CONTACTS-ID" "emails" <<'APPLESCRIPT'
on recordSafe(inputText)
  set fieldText to inputText as text
  if fieldText contains tab or fieldText contains return or fieldText contains linefeed then error "Contact metadata contains a record delimiter; use visible Contacts UI instead"
  return fieldText
end recordSafe

on joinValues(valuesList)
  set previousDelimiters to AppleScript's text item delimiters
  set AppleScript's text item delimiters to ", "
  set joinedText to valuesList as text
  set AppleScript's text item delimiters to previousDelimiters
  return my recordSafe(joinedText)
end joinValues

on run argv
  set recordID to item 1 of argv
  set requestedField to item 2 of argv
  if requestedField is not "basic" and requestedField is not "emails" and requestedField is not "phones" then error "Field must be basic, emails, or phones"
  tell application "Contacts"
    set matches to every person whose id is recordID
    if (count matches) is not 1 then error "Expected exactly one contact for ID " & recordID
    set contactRecord to item 1 of matches
    set organizationText to organization of contactRecord
    if organizationText is missing value then set organizationText to ""
    set requestedValues to {}
    if requestedField is "emails" then set requestedValues to value of every email of contactRecord
    if requestedField is "phones" then set requestedValues to value of every phone of contactRecord
    return (id of contactRecord as text) & tab & my recordSafe(name of contactRecord) & tab & my recordSafe(organizationText) & tab & (modification date of contactRecord as integer as text) & tab & requestedField & tab & my joinValues(requestedValues)
  end tell
end run
APPLESCRIPT
```

Do not request `vcard`, `note`, `image`, or all `properties` for routine lookup; those return substantially more personal data. The serialized recipes reject tab/newline delimiters in app-controlled fields rather than allowing a contact to forge rows; use visible Contacts UI for such a record.

## Create one contact

Preview these values and the exact email/phone labels first. An explicit request containing every field and label can authorize this reversible write; otherwise confirm the preview. Empty contact-value arguments are left unset; never invent a label.

```bash
osascript - "Casey" "Morgan" "Contoso" "casey@example.com" "work" "+1 555 010 0200" "mobile" <<'APPLESCRIPT'
on recordSafe(inputText)
  set fieldText to inputText as text
  if fieldText contains tab or fieldText contains return or fieldText contains linefeed then error "Contact write value contains a record delimiter"
  return fieldText
end recordSafe

on run argv
  set firstNameValue to item 1 of argv
  set lastNameValue to item 2 of argv
  set organizationValue to item 3 of argv
  set emailValue to item 4 of argv
  set emailLabel to item 5 of argv
  set phoneValue to item 6 of argv
  set phoneLabel to item 7 of argv
  repeat with fieldValue in {firstNameValue, lastNameValue, organizationValue, emailValue, emailLabel, phoneValue, phoneLabel}
    my recordSafe(fieldValue)
  end repeat
  if emailValue is not "" and emailLabel is "" then error "Email label must be explicit"
  if phoneValue is not "" and phoneLabel is "" then error "Phone label must be explicit"
  tell application "Contacts"
    if unsaved then error "Contacts already has unsaved changes; save or discard them in the app before automation"
    set newContact to make new person with properties {first name:firstNameValue, last name:lastNameValue}
    if organizationValue is not "" then set organization of newContact to organizationValue
    if emailValue is not "" then make new email at end of emails of newContact with properties {label:emailLabel, value:emailValue}
    if phoneValue is not "" then make new phone at end of phones of newContact with properties {label:phoneLabel, value:phoneValue}
    save
    return id of newContact as text
  end tell
end run
APPLESCRIPT
```

The mutation refuses to begin while Contacts reports any preexisting unsaved change because `save` commits the app's global pending state. Use the returned ID to read the new contact back. If the command errors after mutation may have begun, warn that Contacts may contain pending unsaved changes, inspect the app, and search for the expected new contact before considering any retry; never issue a blanket `save` automatically.

## Update one field by ID

Construct a narrow script for the requested field; do not implement dynamic property names. This example changes only `organization`:

```bash
osascript - "CONTACTS-ID" 3850000000 "Contoso" <<'APPLESCRIPT'
on recordSafe(inputText)
  set fieldText to inputText as text
  if fieldText contains tab or fieldText contains return or fieldText contains linefeed then error "Contact write value contains a record delimiter"
  return fieldText
end recordSafe

on run argv
  set recordID to item 1 of argv
  set expectedModification to item 2 of argv as integer
  set newOrganization to item 3 of argv
  my recordSafe(newOrganization)
  tell application "Contacts"
    if unsaved then error "Contacts already has unsaved changes; save or discard them in the app before automation"
    set matches to every person whose id is recordID
    if (count matches) is not 1 then error "Expected exactly one contact for ID " & recordID
    set contactRecord to item 1 of matches
    if (modification date of contactRecord as integer) is not expectedModification then error "Contact changed after preview"
    set organization of contactRecord to newOrganization
    save
    return (id of contactRecord as text) & tab & (organization of contactRecord as text) & tab & (modification date of contactRecord as integer as text)
  end tell
end run
APPLESCRIPT
```

Pass the exact modification-date integer returned by the resolved-contact read. The same script compares it immediately before assignment, so any intervening contact edit aborts instead of being overwritten. It also refuses to begin when Contacts already has unsaved changes. Read the field back in a separate command and compare it to the preview.

## Add one person to one group

Resolve the contact ID and stable group ID independently before this write. If duplicate group names exist during discovery, pause instead of choosing one.

Discover bounded group candidates by ID and name:

```bash
osascript - "Project" 20 <<'APPLESCRIPT'
on containsVisibleText(inputText)
  repeat with characterValue in characters of inputText
    set characterText to characterValue as text
    if characterText is not space and characterText is not tab and characterText is not return and characterText is not linefeed then return true
  end repeat
  return false
end containsVisibleText

on recordSafe(inputText)
  set fieldText to inputText as text
  if fieldText contains tab or fieldText contains return or fieldText contains linefeed then error "Group metadata contains a record delimiter; use visible Contacts UI instead"
  return fieldText
end recordSafe

on run argv
  set queryText to item 1 of argv
  set maximumResults to item 2 of argv as integer
  if not my containsVisibleText(queryText) then error "Group search cannot be blank"
  if maximumResults < 1 or maximumResults > 25 then error "Maximum results must be between 1 and 25"
  tell application "Contacts"
    set matches to every group whose name contains queryText
    set rows to {}
    repeat with groupRecord in matches
      set end of rows to (id of groupRecord as text) & tab & my recordSafe(name of groupRecord) & tab & (modification date of groupRecord as integer as text)
      if (count rows) is greater than or equal to maximumResults then exit repeat
    end repeat
  end tell
  set previousDelimiters to AppleScript's text item delimiters
  set AppleScript's text item delimiters to linefeed
  set outputText to rows as text
  set AppleScript's text item delimiters to previousDelimiters
  return outputText
end run
APPLESCRIPT
```

```bash
osascript - "CONTACTS-ID" 3850000000 "GROUP-ID" 3850000001 <<'APPLESCRIPT'
on recordSafe(inputText)
  set fieldText to inputText as text
  if fieldText contains tab or fieldText contains return or fieldText contains linefeed then error "Group metadata contains a record delimiter; use visible Contacts UI instead"
  return fieldText
end recordSafe

on run argv
  set recordID to item 1 of argv
  set expectedContactModification to item 2 of argv as integer
  set groupID to item 3 of argv
  set expectedGroupModification to item 4 of argv as integer
  tell application "Contacts"
    if unsaved then error "Contacts already has unsaved changes; save or discard them in the app before automation"
    set peopleMatches to every person whose id is recordID
    set groupMatches to every group whose id is groupID
    if (count peopleMatches) is not 1 then error "Contact ID did not resolve uniquely"
    if (count groupMatches) is not 1 then error "Group ID did not resolve uniquely"
    set contactRecord to item 1 of peopleMatches
    set targetGroup to item 1 of groupMatches
    if (modification date of contactRecord as integer) is not expectedContactModification then error "Contact changed after preview"
    if (modification date of targetGroup as integer) is not expectedGroupModification then error "Group changed after preview"
    my recordSafe(name of targetGroup)
    add contactRecord to targetGroup
    save
    return (id of contactRecord as text) & tab & (name of targetGroup as text)
  end tell
end run
APPLESCRIPT
```

Use `remove contactRecord from targetGroup` for the inverse operation, under the same modification-date, preview, and verification rules.

## Delete one resolved contact

Run only after a separate confirmation that names the exact contact and ID:

```bash
osascript - "CONTACTS-ID" 3850000000 "Casey Morgan" <<'APPLESCRIPT'
on run argv
  set recordID to item 1 of argv
  set expectedModification to item 2 of argv as integer
  set expectedName to item 3 of argv
  tell application "Contacts"
    if unsaved then error "Contacts already has unsaved changes; save or discard them in the app before automation"
    set matches to every person whose id is recordID
    if (count matches) is not 1 then error "Contact ID did not resolve uniquely"
    set contactRecord to item 1 of matches
    if (name of contactRecord as text) is not expectedName then error "Contact identity changed after confirmation"
    if (modification date of contactRecord as integer) is not expectedModification then error "Contact changed after confirmation"
    delete contactRecord
    save
  end tell
  return recordID
end run
APPLESCRIPT
```

Pass the exact confirmed display name and modification-date integer from the resolved-contact read. The modification value binds all fields, including whichever masked email, phone, or organization established identity during confirmation. The script refuses to begin while Contacts has preexisting unsaved changes. After deletion, query the same ID and verify that zero records remain. Never loop over a search result for deletion, and never script a merge by deleting one of two similar cards.
