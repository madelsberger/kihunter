const batcher = require("../lib/batcher.js");

describe("batcher", function () {

  beforeEach(function () {
    jasmine.clock().install();

    this.propertiesMock = {
      tmijs : { channels : 'channel1, channel2' }
    , chat : {
        commandprefix : '!'
      , feedback : {batch :{
          interval : {
            min : Math.floor(Math.random() * 10) + 1
          , max : Math.floor(Math.random() * 40) + 21
          }
        , length : 450
        }}
      }
    };

    this.clientMock = {
      action : jasmine.createSpy("action")
    };

    this.getBatcher = function () {
      return batcher(this.propertiesMock, this.clientMock);
    };
  });

  afterEach(function () {
    jasmine.clock().uninstall();
  });

  describe(".start(channel) initiates a loop, which", function () {
    describe("if there are no guesses", function () {
      it("messages the channel every chat.feedback.interval.max ticks",
          function () {
        const cp = this.propertiesMock.chat.commandprefix;
        const msMax = 
                  this.propertiesMock.chat.feedback.batch.interval.max * 1000;
        const batcher = this.getBatcher();

        batcher.start("#channel1");
        jasmine.clock().tick(50);
        batcher.start("#channel2");

        for (let i = 0; i < 1; i++) {
          jasmine.clock().tick(msMax - 51);
          expect(this.clientMock.action).not.toHaveBeenCalled();
          jasmine.clock().tick(1);
          expect(this.clientMock.action).toHaveBeenCalledTimes(1);
          expect(this.clientMock.action).toHaveBeenCalledWith( "#channel1", 
                             `is waiting for more guesses (${cp}keyguess #)`);
          this.clientMock.action.calls.reset();

          jasmine.clock().tick(49);
          expect(this.clientMock.action).not.toHaveBeenCalled();
          jasmine.clock().tick(1);
          expect(this.clientMock.action).toHaveBeenCalledTimes(1);
          expect(this.clientMock.action).toHaveBeenCalledWith( "#channel2", 
                             `is waiting for more guesses (${cp}keyguess #)`);
          this.clientMock.action.calls.reset();
        }
      });

      it("respnods to stop() by calling kill() on the next tick", function () {
        const batcher = this.getBatcher();
        spyOn(batcher, "kill");

        batcher.start("#channel1");
        expect(batcher.kill).not.toHaveBeenCalled();
        batcher.stop("#channel1");
        jasmine.clock().tick(1000);

        expect(batcher.kill).toHaveBeenCalledTimes(1);
        expect(batcher.kill).toHaveBeenCalledWith("#channel1");
      });
    });

    it(  "handles timing for each channel separately, and knows which channel "
       + "each guess is for", function () {
      const cp = this.propertiesMock.chat.commandprefix;

      this.propertiesMock.chat.feedback.batch.interval.min = 10;
      this.propertiesMock.chat.feedback.batch.interval.max = 20;
      this.propertiesMock.chat.feedback.batch.length = 221;

      const batcher = this.getBatcher();
      batcher.start("#channel1");
      batcher.start("#channel2");
        
      // note the 21 characters for the message boilerplate don't count in
      // calculating the % full
      loadGuesses(batcher, "#channel1", 121);

      jasmine.clock().tick(14999);
      expect(this.clientMock.action).not.toHaveBeenCalled();
      jasmine.clock().tick(1);
      verifyBatchMessage(this.clientMock, "#channel1", 121, true);
      expect(this.clientMock.action).not
                       .toHaveBeenCalledWith("#channel2", jasmine.any(String));
      this.clientMock.action.calls.reset();

      jasmine.clock().tick(9000);
      expect(this.clientMock.action).toHaveBeenCalledWith(
                "#channel2", `is waiting for more guesses (${cp}keyguess #)`);
    });

    describe("if there are guesses, but too few to reach max message length",
        function () {
      it("sends a message between the min and max interval",
          function () {
        this.propertiesMock.chat.feedback.batch.interval.min = 10;
        this.propertiesMock.chat.feedback.batch.interval.max = 20;
        this.propertiesMock.chat.feedback.batch.length = 221;

        const batcher = this.getBatcher();
        batcher.start("#channel1");
        
        // note the 21 characters for the message boilerplate don't count in
        // calculating the % full
        loadGuesses(batcher, "#channel1", 121);

        jasmine.clock().tick(14999);
        expect(this.clientMock.action).not.toHaveBeenCalled();
        jasmine.clock().tick(1);
        verifyBatchMessage(this.clientMock, "#channel1", 121, true);
      });
    });

    describe("if there are enough guesses to reach max message length",
        function () {
      it("sends a message when the minimum interval has passed", function () {
        const length = this.propertiesMock.chat.feedback.batch.length;
        const msMin = 
                  this.propertiesMock.chat.feedback.batch.interval.min * 1000;
        const batcher = this.getBatcher();

        batcher.start('#channel1');

        loadGuesses(batcher, "#channel1", length);
        jasmine.clock().tick(msMin - 1);
        expect(this.clientMock.action).not.toHaveBeenCalled();
        jasmine.clock().tick(1);
        verifyBatchMessage(this.clientMock, "#channel1", length, true);
        this.clientMock.action.calls.reset();

        loadGuesses(batcher, "#channel1", 40);
        jasmine.clock().tick(msMin - 1);
        loadGuesses(batcher, "#channel1", length - 40, true);
        expect(this.clientMock.action).not.toHaveBeenCalled();
        jasmine.clock().tick(1);
        verifyBatchMessage(this.clientMock, "#channel1", length, true);
      });
    });

    describe("if there are enough guesses to pass max message length",
        function () {
      it("holds back some guesses for a second message", function () {
        const length = this.propertiesMock.chat.feedback.batch.length;
        const msMin = 
                  this.propertiesMock.chat.feedback.batch.interval.min * 1000;
        const msMax = 
                  this.propertiesMock.chat.feedback.batch.interval.max * 1000;
        const batcher = this.getBatcher();

        batcher.start('#channel1');

        loadGuesses(batcher, "#channel1", length + 100);
        jasmine.clock().tick(msMin - 1);
        expect(this.clientMock.action).not.toHaveBeenCalled();
        jasmine.clock().tick(1);
        verifyBatchMessage(this.clientMock, "#channel1", length, false);
        this.clientMock.action.calls.reset();
        jasmine.clock().tick(msMax);
        verifyBatchMessage(this.clientMock, "#channel1", length, false);
      });
    });
  });

  describe(".stop() suspends the timer, such that", function () {
    it(  "batched guesses are sent after the minimum interval (but not on the"
         + "tick immediately after the stop)", function () {
      const msMin = 
                this.propertiesMock.chat.feedback.batch.interval.min * 1000;
      const batcher = this.getBatcher();

      batcher.start('#channel1');

      loadGuesses(batcher, '#channel1', 50);
      jasmine.clock().tick(msMin - 1);
      batcher.stop('#channel1');

      expect(this.clientMock.action).not.toHaveBeenCalled();
      jasmine.clock().tick(1001);
      verifyBatchMessage(this.clientMock, '#channel1', 50, true);
    });

    it("the timer can be restarted, negating the stop", function () {
      const msMin = 
                this.propertiesMock.chat.feedback.batch.interval.min * 1000;
      const msMax = 
                this.propertiesMock.chat.feedback.batch.interval.max * 1000;
      const batcher = this.getBatcher();

      batcher.start('#channel1');

      loadGuesses(batcher, '#channel1', 50);
      jasmine.clock().tick(msMin - 1);
      batcher.stop('#channel1');

      expect(this.clientMock.action).not.toHaveBeenCalled();
      jasmine.clock().tick(1000);
      batcher.start('#channel1');
      jasmine.clock().tick(1);
      expect(this.clientMock.action).not.toHaveBeenCalled();

      jasmine.clock().tick(msMax - msMin - 1000);
      verifyBatchMessage(this.clientMock, '#channel1', 50, true);
    });

    it("only the specified channel is affected", function () {
      const msMin = 
                this.propertiesMock.chat.feedback.batch.interval.min * 1000;
      const msMax = 
                this.propertiesMock.chat.feedback.batch.interval.max * 1000;
      const batcher = this.getBatcher();

      batcher.start('#channel1');
      batcher.start('#channel2');

      loadGuesses(batcher, '#channel1', 50);
      loadGuesses(batcher, '#channel2', 50);
      jasmine.clock().tick(msMin - 1);
      batcher.stop('#channel1');

      expect(this.clientMock.action).not.toHaveBeenCalled();
      jasmine.clock().tick(1001);
      verifyBatchMessage(this.clientMock, '#channel1', 50, true);
      expect(this.clientMock.action).not
        .toHaveBeenCalledWith("#channel2", jasmine.any(String));
      this.clientMock.action.calls.reset();

      jasmine.clock().tick(msMax - msMin - 1000);
      verifyBatchMessage(this.clientMock, '#channel2', 50, true);
    });
  });

  describe(".kill() immediately cancels the timer, such that", function () {
    it("any batched guesses are discarded", function () {
      const msMin = 
                this.propertiesMock.chat.feedback.batch.interval.min * 1000;
      const msMax = 
                this.propertiesMock.chat.feedback.batch.interval.max * 1000;
      const batcher = this.getBatcher();

      batcher.start('#channel1');

      loadGuesses(batcher, '#channel1', 50);
      jasmine.clock().tick(msMin - 1);
      batcher.kill('#channel1');

      jasmine.clock().tick(msMax);
      expect(this.clientMock.action).not.toHaveBeenCalled();
    });

    it("a subsequent call to start() restarts from scratch", function () {
      const msMin = 
                this.propertiesMock.chat.feedback.batch.interval.min * 1000;
      const msMax = 
                this.propertiesMock.chat.feedback.batch.interval.max * 1000;
      const batcher = this.getBatcher();

      batcher.start('#channel1');

      loadGuesses(batcher, '#channel1', 50);
      jasmine.clock().tick(msMin - 1);
      batcher.kill('#channel1');

      jasmine.clock().tick(1000);
      batcher.start('#channel1');
      jasmine.clock().tick(msMax - 1);
      expect(this.clientMock.action).not.toHaveBeenCalled();
    });

    it("only the specified channel is affected", function () {
      const msMin = 
                this.propertiesMock.chat.feedback.batch.interval.min * 1000;
      const msMax = 
                this.propertiesMock.chat.feedback.batch.interval.max * 1000;
      const batcher = this.getBatcher();

      batcher.start('#channel1');
      batcher.start('#channel2');

      loadGuesses(batcher, '#channel1', 50);
      loadGuesses(batcher, '#channel2', 50);
      jasmine.clock().tick(msMin - 1);
      batcher.kill('#channel1');

      jasmine.clock().tick(1001);
      expect(this.clientMock.action).not.toHaveBeenCalled();

      jasmine.clock().tick(msMax - msMin - 1000);
      verifyBatchMessage(this.clientMock, '#channel2', 50, true);
    });
  });

  it("won't accept a max message length less than 100", function () {
    const msMin = this.propertiesMock.chat.feedback.batch.interval.min * 1000;

    this.propertiesMock.chat.feedback.batch.length = 99;
    const batcher = this.getBatcher();

    batcher.start("#channel1");
    loadGuesses (batcher, "#channel1", 100);
    jasmine.clock().tick(msMin);
    verifyBatchMessage(this.clientMock, "#channel1", 100, true);
  });
});


function loadGuesses (batcher, channel, length, appending) {
  let username;
  let dlen = appending ? 3 : 22;

  while (length - dlen > 35) {
    username = "x".repeat(Math.floor(Math.random() * 20) + 5);
    batcher.addGuess(channel, username);
    length -= (username.length + dlen);
    dlen = 3;
  }

  username = "x".repeat(length - dlen);
  batcher.addGuess(channel, username);
}

function verifyBatchMessage (mock, channel, length, exactLen) {
  expect(mock.action).toHaveBeenCalledTimes(1);
  expect(mock.action).toHaveBeenCalledWith(channel,
              jasmine.stringMatching(/^recorded guesses for @x+(?:, @x+)*$/) );
  expect(mock.action).toHaveBeenCalledWith(channel,
              jasmine.stringMatching(new RegExp(exactLen? `^.{${length}}$`
                                                        : `^.{23,${length}}$`))
  );
}
