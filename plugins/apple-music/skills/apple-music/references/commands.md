# Apple Music command reference

These recipes use the scripting dictionary bundled with the macOS Music app. Pass search terms and identifiers through `argv`; do not concatenate user input into AppleScript source.

## Preflight and permissions

Run the non-library preflight first:

```bash
uname -s
command -v osascript
test -d /System/Applications/Music.app
sdef /System/Applications/Music.app >/dev/null
```

The first Music command may trigger an Automation prompt. If access is denied, have the user open **System Settings > Privacy & Security > Automation**, find the terminal or agent host, and enable Music. Apple Event error `-1743` usually means the grant is missing.

Do not request Full Disk Access. Do not inspect or edit `~/Music/Music/` database files. Do not run `tccutil reset` without explicit user approval.

## Read now-playing state

This reads playback metadata only; it does not start playback:

```bash
osascript <<'APPLESCRIPT'
on recordSafe(inputText)
  set fieldText to inputText as text
  if fieldText contains tab or fieldText contains return or fieldText contains linefeed then error "Music metadata contains a record delimiter; use visible Music UI instead"
  return fieldText
end recordSafe

on localFileFlag(trackRecord)
  tell application "Music"
    try
      set trackLocation to location of trackRecord
      if trackLocation is not missing value then return "true"
    end try
  end tell
  return "false"
end localFileFlag

tell application "Music"
  set stateText to player state as text
  if not (exists current track) then return "state=" & stateText
  set currentItem to current track
  return "state=" & stateText & tab & "name=" & my recordSafe(name of currentItem) & tab & "artist=" & my recordSafe(artist of currentItem) & tab & "album=" & my recordSafe(album of currentItem) & tab & "persistent_id=" & (persistent ID of currentItem as text) & tab & "cloud_status=" & my recordSafe(cloud status of currentItem as text) & tab & "local_file=" & my localFileFlag(currentItem) & tab & "position=" & (player position as text)
end tell
APPLESCRIPT
```

Avoid returning `properties of current track`; that can include unnecessary account, comment, lyrics, and location metadata.

## Control playback

Use only the command explicitly requested:

```bash
osascript -e 'tell application "Music" to pause'
osascript -e 'tell application "Music" to playpause'
osascript -e 'tell application "Music" to next track'
osascript -e 'tell application "Music" to back track'
osascript -e 'tell application "Music" to stop'
```

Set volume only to a user-requested value from 0 through 100:

```bash
osascript - 35 <<'APPLESCRIPT'
on run argv
  set requestedVolume to item 1 of argv as integer
  if requestedVolume < 0 or requestedVolume > 100 then error "Volume must be between 0 and 100"
  tell application "Music"
    set sound volume to requestedVolume
    return sound volume as text
  end tell
end run
APPLESCRIPT
```

After playback control, read `player state`, `current track`, or `sound volume` back as appropriate.

## Search the local library

Search one field at a time and intersect further in the agent workflow if necessary. This name search returns at most the requested number of candidates:

```bash
osascript - "Blue" 10 <<'APPLESCRIPT'
on containsVisibleText(inputText)
  repeat with characterValue in characters of inputText
    set characterText to characterValue as text
    if characterText is not space and characterText is not tab and characterText is not return and characterText is not linefeed then return true
  end repeat
  return false
end containsVisibleText

on recordSafe(inputText)
  set fieldText to inputText as text
  if fieldText contains tab or fieldText contains return or fieldText contains linefeed then error "Music metadata contains a record delimiter; use visible Music UI instead"
  return fieldText
end recordSafe

on localFileFlag(trackRecord)
  tell application "Music"
    try
      set trackLocation to location of trackRecord
      if trackLocation is not missing value then return "true"
    end try
  end tell
  return "false"
end localFileFlag

on run argv
  set queryText to item 1 of argv
  set maximumResults to item 2 of argv as integer
  if not my containsVisibleText(queryText) then error "Music search cannot be blank"
  if maximumResults < 1 or maximumResults > 50 then error "Maximum results must be between 1 and 50"
  tell application "Music"
    set matches to every track of library playlist 1 whose name contains queryText
    set rows to {}
    repeat with trackRecord in matches
      set end of rows to (persistent ID of trackRecord as text) & tab & my recordSafe(name of trackRecord) & tab & my recordSafe(artist of trackRecord) & tab & my recordSafe(album of trackRecord) & tab & my recordSafe(cloud status of trackRecord as text) & tab & my localFileFlag(trackRecord)
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

The final fields are `cloud_status` and a `local_file` boolean; no file path is returned. Use additional `whose` predicates for exact artist or album matches only when the user's request supplies them. If the same persistent ID appears more than once through playlist references, de-duplicate candidates before presenting them. Serialized recipes reject tab/newline delimiters in app-controlled metadata rather than allowing a track to forge rows; use visible Music UI for such an item.

## Play a resolved local track

Use the persistent ID, cloud status, and local-file boolean selected during search. The fourth argument is a separately reviewed network-streaming authorization and must be `true` only when the user approved playback of an item without a local file:

```bash
osascript - "TRACK-PERSISTENT-ID" "matched" "false" "true" <<'APPLESCRIPT'
on localFileFlag(trackRecord)
  tell application "Music"
    try
      set trackLocation to location of trackRecord
      if trackLocation is not missing value then return "true"
    end try
  end tell
  return "false"
end localFileFlag

on run argv
  set trackID to item 1 of argv
  set expectedCloudStatus to item 2 of argv
  set expectedLocalFile to item 3 of argv
  set allowNetworkPlayback to item 4 of argv
  if expectedLocalFile is not "true" and expectedLocalFile is not "false" then error "Expected local-file flag must be true or false"
  if allowNetworkPlayback is not "true" and allowNetworkPlayback is not "false" then error "Network-playback flag must be true or false"
  tell application "Music"
    set matches to every track of library playlist 1 whose persistent ID is trackID
    if (count matches) is not 1 then error "Track persistent ID did not resolve uniquely"
    set selectedTrack to item 1 of matches
    set currentCloudStatus to cloud status of selectedTrack as text
    set currentLocalFile to my localFileFlag(selectedTrack)
    if currentCloudStatus is not expectedCloudStatus or currentLocalFile is not expectedLocalFile then error "Track cloud/local status changed after preview"
    if currentLocalFile is "false" and allowNetworkPlayback is not "true" then error "This track may stream or download; explicit network playback approval is required"
    play selectedTrack
    return (persistent ID of current track as text) & tab & (player state as text) & tab & currentCloudStatus & tab & currentLocalFile
  end tell
end run
APPLESCRIPT
```

Compare the returned ID and cloud/local state to the selected snapshot. The status recheck and playback are separate Apple events, so a residual sync race remains; never replay automatically.

## List user playlists

Return stable IDs and names without enumerating their tracks. Keep the limit between 1 and 50:

```bash
osascript - 50 <<'APPLESCRIPT'
on recordSafe(inputText)
  set fieldText to inputText as text
  if fieldText contains tab or fieldText contains return or fieldText contains linefeed then error "Playlist metadata contains a record delimiter; use visible Music UI instead"
  return fieldText
end recordSafe

on run argv
  set maximumResults to item 1 of argv as integer
  if maximumResults < 1 or maximumResults > 50 then error "Maximum results must be between 1 and 50"
  tell application "Music"
    set rows to {}
    repeat with playlistRecord in user playlists
      set end of rows to (persistent ID of playlistRecord as text) & tab & my recordSafe(name of playlistRecord) & tab & (smart of playlistRecord as text)
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

## Create a regular playlist

Check for an existing playlist with the exact name, preview the creation, and ensure the user authorized it:

```bash
osascript - "Focus Mix" <<'APPLESCRIPT'
on recordSafe(inputText)
  set fieldText to inputText as text
  if fieldText contains tab or fieldText contains return or fieldText contains linefeed then error "Playlist name contains a record delimiter"
  return fieldText
end recordSafe

on run argv
  set playlistName to item 1 of argv
  my recordSafe(playlistName)
  tell application "Music"
    set sameName to every user playlist whose name is playlistName
    if (count sameName) is not 0 then error "A user playlist with this name already exists"
    set newPlaylist to make new user playlist with properties {name:playlistName}
    return (persistent ID of newPlaylist as text) & tab & (name of newPlaylist as text)
  end tell
end run
APPLESCRIPT
```

Re-list the playlist by returned persistent ID before adding tracks.

## Add a resolved track to a resolved playlist

Use stable IDs for both objects. This changes playlist membership without importing another media file:

```bash
osascript - "TRACK-PERSISTENT-ID" "PLAYLIST-PERSISTENT-ID" <<'APPLESCRIPT'
on run argv
  set trackID to item 1 of argv
  set playlistID to item 2 of argv
  tell application "Music"
    set trackMatches to every track of library playlist 1 whose persistent ID is trackID
    set playlistMatches to every user playlist whose persistent ID is playlistID
    if (count trackMatches) is not 1 then error "Track ID did not resolve uniquely"
    if (count playlistMatches) is not 1 then error "Playlist ID did not resolve uniquely"
    set selectedTrack to item 1 of trackMatches
    set targetPlaylist to item 1 of playlistMatches
    if smart of targetPlaylist then error "Cannot manually add tracks to a Smart Playlist"
    set existingMatches to every track of targetPlaylist whose persistent ID is trackID
    if (count existingMatches) is greater than 0 then return (persistent ID of targetPlaylist as text) & tab & "already_present" & tab & (count tracks of targetPlaylist as text)
    duplicate selectedTrack to targetPlaylist
    return (persistent ID of targetPlaylist as text) & tab & "added" & tab & (count tracks of targetPlaylist as text)
  end tell
end run
APPLESCRIPT
```

Verify membership by querying tracks of the resolved playlist for the selected persistent ID. The command returns without writing when that persistent ID is already present, which makes a retry idempotent.

## Consequential library operations

The dictionary also exposes `add` for importing files, `download` for already resolved eligible cloud tracks/playlists, editable track metadata, `delete`, and output-device properties. Do not turn these into broad generic commands. For each operation:

1. Resolve exact tracks/playlists/files or the AirPlay device.
2. Show the intended effect and scope.
3. Obtain a separate confirmation.
4. Apply once.
5. Re-query the exact target.

Clarify whether deletion removes playlist membership or deletes an item from the library. Never delete from `library playlist 1` when the user only asked to remove a track from one playlist.

For `download`, state the network and storage effect, verify the item is already resolved and eligible, obtain separate confirmation, and invoke the dictionary command once. Re-read its exposed `cloud status` plus whether class/location evidence indicates a local item, without returning the file path. The dictionary has no track-level `downloaded` property; if completion remains ambiguous, report that and do not retry automatically. Do not use download as a substitute for catalog search.
