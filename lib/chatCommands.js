// Commands triggered by chat messages
module.exports = function (properties, client, huntState, batchManager) {

  // unpack the properties we'll need
  const locationCount = +properties.core.locationcount; 

  const cp = properties.chat.commandprefix;
  const respondToGoodGuess = (properties.chat.feedback.mode.success == 2);
  const batchGoodGuesses = (properties.chat.feedback.mode.success == 1);
  const respondToBadGuess = (properties.chat.feedback.mode.failure == 2);

  const multiguess = (properties.scoring.multiguess == 'true');
  const points = properties.scoring.points.split(/\s*,\s*/).map(x => +x);


  // cooldown controls
  let listCD;
  (function () {
    let cd = false;
    listCD = function () {
      if (cd) {return true;}

      cd = true;
      setTimeout(function () { cd = false; }, 5000);
      return false;
    };
  }())


  // object contaiing the command functions
  const commands = {

    keyreset : function (channel, user) {
      if ( isMod(channel, user) ) {
        keyresetImpl(channel);
        client.say(channel, "Kihunter reset; ready to start a key hunt", 2);
      }
    }

  , keyopen : function (channel, user) {
      if ( isMod(channel, user) && !huntState[channel].isOpen ) {
        if ( multiguess || huntState[channel].remaining ) { 
          huntState[channel].isOpen = true;
          client.say(channel, 
                 `Where will the key be? Guess now with ${cp}keyguess #` , 2);

          if (batchGoodGuesses) { batchManager.start(channel); }
        } else {
          client.say(channel,
            `@${user.username}, all locations have been guessed`, 2);
        }
      }
    }

  , keylist : function (channel) {
      if (! listCD()) {
        let msg;
        if (huntState[channel].remaining) {
          msg = "The following locations have not been guessed:";
          let delim = "";
          for (const range of openRanges(channel)) {
            msg += `${delim} ${range.start}`;
            if (range.end > range.start) {
              msg += `-${range.end}`;
            }
            delim = ",";
          }
        } else {
          msg = "All locations have been guessed";
        }
        
        client.say(channel, msg);
      }
    }

  , keyguess : function (channel, user, [guess]) {
      if ( huntState[channel].isOpen ) {
        let g = Number(guess);
        if (Number.isInteger(g) && g > 0 && g <= locationCount) {
          let p;
          if (p = huntState[channel].guessers[user.username] ) {
            if (respondToBadGuess) {
              client.say(channel,
                `@${user.username}, you already guessed ${p}!`
              + "One guess per user!", 0);
            }
          } else if ((!multiguess) && (huntState[channel].guesses[g-1])) {
            if (respondToBadGuess) {
              client.say(channel,
                `Sorry, @${user.username}, ${g} was already guessed`, 0);
            }
          } else {
            if ( !(huntState[channel].guesses[g-1]) ) {
              huntState[channel].guesses[g-1] = [];
              huntState[channel].remaining -= 1;
            }
            huntState[channel].guesses[g-1].push(user.username);
            huntState[channel].guessers[user.username] = g;
            if (respondToGoodGuess) {
              client.action(channel,
                `records ${g} as @${user.username}'s guess`);
            } else if (batchGoodGuesses) {
              batchManager.addGuess(channel, user.username);
            }
            if ( !(multiguess || huntState[channel].remaining) ) {
              client.say(channel, "All locations have now been guessed");
              keycloseImpl(channel);
            }
          }
        } else if (respondToBadGuess) {
          if (typeof guess == 'string' && guess.length > 0) {
            client.say(channel,
              `@${user.username}, ${guess} is not a valid guess!`, 0);
          } else {
            client.say(channel, `What is your guess, @${user.username}?`, 0);
          }
        }
      } else {
        if (respondToBadGuess) {
          client.say(channel, 
            `Sorry, @${user.username}, key guessing is not currently open`, 0);
        }
      }
    }

  , keyclose : function (channel, user) {
      if ( isMod(channel, user) ) {
        keycloseImpl(channel);
        client.say(channel, "Guessing is closed", 2);
      }
    }

  , keyfound : function (channel, user, [guess]) {
      if ( isMod(channel, user) ) {
        let g = Number(guess);
        let msg = `The key was found in location ${g}`;

        if (Number.isInteger(g) && g > 0 && g <= locationCount) {
          let w;
          if (w = huntState[channel].guesses[g-1]) {
            let hm = "; honorable mention for";
            let i = 0;
            while ( w.length ) {
              let nm = w.shift();
              let pt = points[i++];

              if (!multiguess) {
                msg += `; winner is ${nm}`;
              } else if (pt) {
                msg += `; ${pt} points for ${nm}`;
              } else {
                msg += `${hm} ${nm}`;
                hm = ",";
              }
            }
          } else {
            msg += "; nobody wins!";
          }
          client.say(channel, msg, 2);
          keyresetImpl(channel);
        } else {
          if (typeof guess == 'string' && guess.length > 0) {
            client.say(channel,
              `@${user.username}, ${guess} is not a valid location number!`, 2);
          } else {
            client.say(channel,
                            "@${user.username}, where was the key found?", 2);
          }
        }
      } 
    }

  };


  // helpers used by commands
  const isMod = function (channel, user) {
    return (   user.mod
            || user['user-type'] === 'mod'
            || channel.slice(1) === user.username
           );
  };

  const keyresetImpl = function (channel) {
    keycloseImpl(channel);
    huntState[channel].guesses = [];
    huntState[channel].guessers = {};
    huntState[channel].remaining = locationCount;
    batchManager.kill(channel);
  };

  const keycloseImpl = function (channel) {
    huntState[channel].isOpen = false;
    if (batchGoodGuesses) { batchManager.stop(channel); }
  };

  const openRanges = function (channel) {
    let guesses = huntState[channel].guesses;
    let ranges = [];
    let r = null;

    for(let i = 0; i < locationCount; i++) {
      if (guesses[i]) {
        r = null;
      } else {
        if (!r) {
          r = {start: i+1};
          ranges.push(r);
        }
        r.end = i + 1;
      }
    }

    return ranges;
  };


  return commands;
};
