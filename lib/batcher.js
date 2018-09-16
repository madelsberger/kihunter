// message batcher for guess feedback
module.exports = function (properties, client) {

  // unpack the properties we'll need
  const channels = properties.tmijs.channels.split(/\s*,\s/);

  const cp = properties.chat.commandprefix;
  const minInterval = +properties.chat.feedback.batch.interval.min;
  const maxInterval = +properties.chat.feedback.batch.interval.max;
  const maxMsgLength =   (+properties.chat.feedback.batch.length < 100) 
                       ? 100
                       : +properties.chat.feedback.batch.length;


  // batch state per channel
  let batchState = {};
  for (const channel of channels) {
    batchState[`#${channel}`] = {
      intervalId: null
    , guesses: []
    , stopping: false
    };
  }

  // the batch manager
  const batcher = {
    start : function (channel) {
      let state = batchState[channel];

      // Start polling for batch data if we're not already.  (If we are, it
      // just menas a previous run didn't finish stopping, which is fine.)
      if (state.intervalId == null) {
        let ticks = 0;
        let stopTick = -1;
        state.intervalId = setInterval(function () {
          ticks++;
          if (state.stopping && stopTick < 0) { stopTick = ticks; }
          if (!state.stopping) { stopTick = -1; }

          if (   ticks >= getTargetTick(state.guesses)
              || (   state.stopping && state.guesses.length 
                  && ticks >= minInterval && ticks != stopTick) ) {
            client.action(channel, buildBatchMessage(state.guesses));
            ticks = 0;
          }
          if ( state.stopping && state.guesses.length == 0 ) {
            batcher.kill(channel);
          }
        }, 1000);
      } 

      state.stopping = false;
    }

  , addGuess : function (channel, user) {
      batchState[channel].guesses.push(user);
    }

  , stop : function (channel) {        // orderly wind-down of running batch
      batchState[channel].stopping = true;
    }

  , kill : function (channel) {        // just drop any running batch now
      if (batchState[channel].intervalId != null) {
        clearInterval(batchState[channel].intervalId);
      }

      batchState[channel] = {
        intervalId: null
      , guesses: []
      , stopping: false
      }
    }
  };


  // helper functions used by the batch manager
  const getTargetTick = function (guesses) {
    let estLen = (3 * guesses.length) - (guesses.length ? 2  : 0);
    for (g of guesses) { estLen += g.length; }
    let pctSpaceLeft = 1 - (estLen / (maxMsgLength - 21));
    if (pctSpaceLeft < 0) {pctSpaceLeft = 0;}

    return minInterval + pctSpaceLeft * (maxInterval - minInterval);
  };

  const buildBatchMessage = function (guesses) {
    let msg = "recorded guesses for ";
    let d = "@";
    if (guesses.length) {
      let g;
      while( g = guesses.shift() ) {
        if (msg.length + d.length + g.length > maxMsgLength) {
          guesses.unshift(g);
          break;
        }
        msg += d + g;
        d = ", @";
      }
    } else {
      msg = `is waiting for more guesses (${cp}keyguess #)`;
    }

    return msg;
  };


  return batcher;

};
