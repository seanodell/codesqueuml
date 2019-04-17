# CodesqueUML

A TypeScript library packaged for npm which converts scribbly bits of pseudocode into extremely ugly PlantUML source code.

"What is CodesqueUML?" you must be wondering.

Let's not go over THAT again. In addition to generating ugly PlantUML source
code, through the magic of npm dependencies
([node-plantuml](https://www.npmjs.com/package/node-plantuml)), it's also
capable of creating quite lovely sequence diagrams in SVG format.

Now you're asking "WHY?" Well, because I have to read a lot of complicated code
and, when I do, I like to make notes about the classes and methods called and
add bits of information to help me understand what everything is doing. Then at
some point I end up wanting a diagram for reference or to share with others, but
by the time I'm done taking notes, I really want to move on to other things.

## Example

See the scribbly code first, then see the lovely sequence diagram after.

### Scribbly Code

```
Application#main(): run queued commands and log all events and status
  Helper#config(): initialize config < config file

  Helper#startHeartbeat() : start heartbeating thread

  performMainRoutine()

    loop over an array of commands

      executeCommand() : execute command < command status
      Utility#logStatus() : log command status < success / failure

  Utility#finishCommand()
    logOverallStatus() : log success / failure and status of all commands

  if heartbeat thread still running
    Helper#stopHeartBeat() : stop heartbeat thread

Helper#heartBeatThread() : heartbeat in the background so system knows we're working
  loop until we're told to stop
    heartbeat() : send heartbeat to server

    if call to server failed
      reconnect()
    else
      sleep() : sleep for 15 minutes
```

### Lovely Sequence Diagram

![Example Diagram](https://raw.githubusercontent.com/seanodell/codesqueuml/master/examples/examples.Application.main.png)
