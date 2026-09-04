' Launch RAM Pulse Electron Widget silently without any command prompt / shell window
Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

electronExe = scriptDir & "\node_modules\electron\dist\electron.exe"
cmd = """" & electronExe & """ """ & scriptDir & """"

' Run completely hidden (window style 0, do not wait)
WshShell.Run cmd, 0, False
