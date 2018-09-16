// Commands triggered by maintainers whispering to the bot's twitch account
module.exports = function (properties, huntState, chatCommands) {

  // unpack the properties we'll need
  const locationCount = +properties.core.locationcount;
  const maintainers = properties.core.maintainers.split(/\s*,\s*/);


  // object containing the command functions
  const commands = {

    logstate : function (from) {
      if (isMaintainer(from)) {
        console.log(huntState);
      }
    }

    // run a command as though it came from a non-mod user with the specified
    // username
  , sudo : function (from, u, [channel, suname, command, ...params]) {
      if (isMaintainer(from)) {
        if (command in chatCommands) {
          chatCommands[command](`#${channel}`, {username: suname}, params);
          console.log(
            `* Executed ${command} chat command as ${suname} for ${u.username}`
          );
        }
      }
    }

    // For testing how we'll handle a lot of rapidly-received messages
  , spamguess : function (from, u, [channel, c]) {
      if (isMaintainer(from)) {
        let n = 0;
        let i;
        i = setInterval(function() {
          if (n < c) {
            n += 1;
            chatCommands.keyguess(`#${channel}`, {username: `spam${n}`},
                                                  [1 + (n % locationCount)] );
          } else {
            clearInterval(i);
          }
        }, 1);
      }
    } 

  };


  // Helpers used by the commands
  const isMaintainer = function (user) {
    return maintainers.indexOf(user.slice(1)) > -1;
  };


  return commands;
};
