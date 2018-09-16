const commands = require("../lib/whisperCommands.js");

describe("whisperCommands", function () {

  beforeEach(function () {
    spyOn(console, "log");

    this.propertiesMock = {
      core : {
        locationcount : 5
      , maintainers : 'link, impa'
      }
    };

    this.chatCommandsMock = {
      keyguess : jasmine.createSpy("keyguess")
    };

    this.getCommands = function (huntStateMock) {
      return commands(this.propertiesMock, huntStateMock || {},
                                                      this.chatCommandsMock);
    };
  });

  describe(".logstate()", function () {
    beforeEach(function () {
      this.commands = this.getCommands({foo: 37});
    });

    it("logs the huntState object", function () {
      this.commands.logstate("#link");
      expect(console.log).toHaveBeenCalledWith({foo: 37});
    });

    it("only works for maintainers", function () {
      this.commands.logstate("#ganon");
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe(".sudo()", function () {
    beforeEach(function () {
      this.commands = this.getCommands();
    });

    it("executes a chat command using a spoofed username", function () {
      this.commands.sudo("#link", {}, ['c', 'my_dude', 'keyguess', 7]);

      expect(this.chatCommandsMock.keyguess)
                     .toHaveBeenCalledWith('#c', {username: 'my_dude'}, [7]);
      expect(console.log).toHaveBeenCalled();
    });

    it("ignores calls for unknown commands", function () {
      this.commands.sudo("#link", {}, ['c', 'navi', 'listen']);
      expect(console.log).not.toHaveBeenCalled();
    });

    it("only works for maintainers", function () {
      this.commands.sudo("#ganon", {}, ['c', 'zelda', 'keyguess', 3]);

      expect(this.chatCommandsMock.keyguess).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe(".spamguess()", function () {
    beforeEach(function () {
      jasmine.clock().install();
    });

    afterEach(function() {
      jasmine.clock().uninstall();
    });

    it("sends a specified number of keyguess commands, 1 per ms", function () {
      this.getCommands().spamguess("#link", {}, ['c', 1000]);
      jasmine.clock().tick(1000);

      expect(this.chatCommandsMock.keyguess).toHaveBeenCalledTimes(1000);
    });

    it("only works for maintainers", function () {
      this.getCommands().spamguess("#ganon", {}, ['c', 1000]);
      jasmine.clock().tick(1000);

      expect(this.chatCommandsMock.keyguess).not.toHaveBeenCalled();
    });
  });
});
