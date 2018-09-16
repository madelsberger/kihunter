const commands = require('../lib/chatCommands.js');

describe("chatCommands", function () {

  beforeEach(function () {
    this.propertiesMock = {
      core : {locationcount: 5}
    , chat : {
        commandprefix: '!'
      , feedback : {mode : {
          success : 1
        , failure : 2
        }}
      }
    , scoring : {
        multiguess : 'true'
      , points : '7, 3, 1'
      }
    };

    this.clientMock = {
      action : jasmine.createSpy('action')
    , say : jasmine.createSpy('say')
    };

    this.huntStateMock = {
    };

    this.batchManagerMock = {
      addGuess : jasmine.createSpy('addGuess')
    , kill : jasmine.createSpy('kill')
    , stop : jasmine.createSpy('stop')
    , start : jasmine.createSpy('start')
    };

    this.getCommands = function () {
      return commands(this.propertiesMock, this.clientMock, 
                                   this.huntStateMock, this.batchManagerMock);
    };
  });

  describe(".keyreset()", function () {
    beforeEach(function () {
      this.huntStateMock['#link'] = {
        isOpen : true
      , guesses : [['link'], undefined, ['ruto']]
      , guessers : {
          'link': 1
        , 'ruto': 3
        }
      , remaining : 3
      };
      this.huntStateMock['#zelda'] = {
        isOpen : true
      , guesses : [undefined, ['ganon'], undefined, ['impa']]
      , guessers : {
          'ganon': 2
        , 'impa': 4
        }
      , remaining : 3
      };

      this.commands = this.getCommands();
    });

    it("closes guessing on the channel", function () {
      this.commands.keyreset('#link', {mod: true});

      expect(this.huntStateMock['#link'].isOpen).toBe(false);
      expect(this.batchManagerMock.stop).toHaveBeenCalledTimes(1);
      expect(this.batchManagerMock.stop).toHaveBeenCalledWith('#link');

      expect(this.huntStateMock['#zelda'].isOpen).toBe(true);
    });

    it("discards any guesses made on the channel", function () {
      this.commands.keyreset('#link', {mod: true});

      expect(this.huntStateMock['#link'].guesses).toEqual([]);
      expect(this.huntStateMock['#link'].guessers).toEqual({});
      expect(this.huntStateMock['#link'].remaining).toEqual(5);

      expect(this.huntStateMock['#zelda'].guesses).toEqual(
                                 [undefined, ['ganon'], undefined, ['impa']]);
      expect(this.huntStateMock['#zelda'].guessers).toEqual({
          'ganon': 2
        , 'impa': 4
        }
      );
      expect(this.huntStateMock['#zelda'].remaining).toEqual(3);
    });

    it("sends a high-priority message to the chat", function () {
      this.commands.keyreset('#link', {mod: true});
      
      expect(this.clientMock.say).toHaveBeenCalledWith(
                       '#link', jasmine.stringMatching(/^Kihunter reset/), 2);
    });

    it("discards any pending 'batch of guesses' message", function () {
      this.commands.keyreset('#link', {mod: true});
      expect(this.batchManagerMock.kill).toHaveBeenCalled();
    });

    it("only works for mods", function () {
      this.commands.keyreset('#link', {username: 'ganon'});

      expect(this.huntStateMock['#link'].isOpen).toBe(true);
      expect(this.clientMock.say).not.toHaveBeenCalled();
      expect(this.huntStateMock['#link'].guesses).toEqual(
                                 [['link'], undefined, ['ruto']]);
      expect(this.huntStateMock['#link'].guessers).toEqual({
          'link': 1
        , 'ruto': 3
        }
      );
      expect(this.huntStateMock['#link'].remaining).toEqual(3);
      expect(this.batchManagerMock.kill).not.toHaveBeenCalled();
    });
  });

  describe(".keyopen()", function () {
    beforeEach(function () {
      this.huntStateMock['#link'] = {
        isOpen : false
      , guesses : []
      , guessers : {}
      , remaining : 5
      };
    });

    it("opens guessing on the channel", function () {
      this.getCommands().keyopen('#link', {mod: true});
      expect(this.huntStateMock['#link'].isOpen).toBeTruthy();
    });

    it("keeps any existing guesses", function () {
      this.huntStateMock['#link'].guesses = [['ruto']];
      this.huntStateMock['#link'].guessers = {ruto : 1};
      this.huntStateMock['#link'].remaining = 4;

      this.getCommands().keyopen('#link', {mod: true});

      expect(this.huntStateMock['#link'].guesses).toEqual([['ruto']]);
      expect(this.huntStateMock['#link'].guessers).toEqual({ruto: 1});
      expect(this.huntStateMock['#link'].remaining).toEqual(4);
    });

    it("makes sure the batcher is running if necessary", function () {
      this.getCommands().keyopen('#link', {mod: true});
      expect(this.batchManagerMock.start).toHaveBeenCalled();
    });

    it("fails if there's no available guess", function () {
      this.propertiesMock.scoring.multiguess = "false";
      this.huntStateMock['#link'].remaining = 0;
      this.getCommands().keyopen('#link', {mod: true});

      expect(this.huntStateMock['#link'].isOpen).toBeFalsy();
    });

    it("only works for mods", function () {
      this.getCommands().keyopen('#link', {username: 'ganon'});
      expect(this.huntStateMock['#link'].isOpen).toBeFalsy();
      expect(this.clientMock.say).not.toHaveBeenCalled();
    });
  });

  describe(".keylist()", function () {
    beforeEach(function () {
      this.huntStateMock['#link'] = {
        isOpen : false
      , guesses : []
      , remaining : 5
      };
    });

    it("indicates the available range of guesses if nothing has been guessed",
        function () {
      this.getCommands().keylist('#link');
      expect(this.clientMock.say).toHaveBeenCalledWith(
                                       '#link', jasmine.stringMatching(/1-5/));
    });

    it("indicates the ungessed ranges of guesses", function () {
      this.huntStateMock['#link'].guesses[1] = ['talon'];
      this.huntStateMock['#link'].remaining = 4;

      this.getCommands().keylist('#link');

      expect(this.clientMock.say).toHaveBeenCalledWith(
                             '#link', jasmine.stringMatching(/1,.*3-5/));
      expect(this.clientMock.say).not.toHaveBeenCalledWith(
                             '#link', jasmine.stringMatching(/2/));
    });

    it("indicates if all locations have at least one guess", function () {
      this.huntStateMock['#link'].guesses[0] = ['malon'];
      this.huntStateMock['#link'].guesses[1] = ['talon'];
      this.huntStateMock['#link'].guesses[2] = ['ruto'];
      this.huntStateMock['#link'].guesses[3] = ['saria'];
      this.huntStateMock['#link'].guesses[4] = ['anju'];
      this.huntStateMock['#link'].remaining = 0;

      this.getCommands().keylist('#link');
      expect(this.clientMock.say).toHaveBeenCalledWith(
                                   '#link', 'All locations have been guessed');
    });
  });

  describe(".keyguess()", function () {
    beforeEach(function () {
      this.huntStateMock['#link'] = {
        guesses : []
      , guessers : {}
      };
    });

    describe("if guessing is open", function () {
      beforeEach(function () {
        this.huntStateMock['#link'].isOpen = true;
      });

      describe("and a valid guess is given", function () {
        describe("only takes one guess per user", function () {
          beforeEach(function () {
            this.huntStateMock['#link'].guessers['impa'] = 1;
            this.huntStateMock['#link'].guesses[0] = ['impa'];
            this.huntStateMock['#link'].remaining = 4;
          });

          it("and, by default, tells chat it rejected the guess", function () {
            this.getCommands().keyguess('#link', {username: 'impa'}, [2]);
  
            expect(this.huntStateMock['#link'].guesses[1]).toEqual(undefined);
            expect(this.huntStateMock['#link'].guessers.impa).toEqual(1);
            expect(this.huntStateMock['#link'].remaining).toEqual(4);
            expect(this.clientMock.say).toHaveBeenCalled();
          });

          it("silently if 'bad guess' feedback is disabled", function () {
            this.propertiesMock.chat.feedback.mode.failure = 0;
            this.getCommands().keyguess('#link', {username: 'impa'}, [2]);
  
            expect(this.huntStateMock['#link'].guesses[1]).toEqual(undefined);
            expect(this.huntStateMock['#link'].guessers.impa).toEqual(1);
            expect(this.huntStateMock['#link'].remaining).toEqual(4);
            expect(this.clientMock.say).not.toHaveBeenCalled();
          });
        });

        describe("that has been guessed before", function () {
          beforeEach(function () {
            this.huntStateMock['#link'].guessers['bagu'] = 1;
            this.huntStateMock['#link'].guesses[0] = ['bagu'];
            this.huntStateMock['#link'].remaining = 4;
          });

          describe("if multi-guessing is off, rejects the guess", function () {
            beforeEach(function () {
              this.propertiesMock.scoring.multiguess = 'false';
            });

            it("and, by default, notifies chat", function () {
              this.getCommands().keyguess('#link', {username: 'error'}, [1]);

              expect(this.huntStateMock['#link'].guesses[0]).toEqual(['bagu']);
              expect(this.huntStateMock['#link']
                                              .guessers.error).toBe(undefined);
              expect(this.huntStateMock['#link'].remaining).toEqual(4);
              expect(this.clientMock.say).toHaveBeenCalled();
            });

            it("silently if 'bad guess' feedback is disabled", function () {
              this.propertiesMock.chat.feedback.mode.failure = 0;
              this.getCommands().keyguess('#link', {username: 'error'}, [1]);

              expect(this.huntStateMock['#link'].guesses[0]).toEqual(['bagu']);
              expect(this.huntStateMock['#link']
                                              .guessers.error).toBe(undefined);
              expect(this.huntStateMock['#link'].remaining).toEqual(4);
              expect(this.clientMock.say).not.toHaveBeenCalled();
            });
          });

          describe("if multi-guessing is on, records the guess", function () {
            it("and, by default, batches a notification", function () {
              this.getCommands().keyguess('#link', {username: 'error'}, [1]);

              expect(this.huntStateMock['#link'].guesses[0])
                                                  .toEqual(['bagu', 'error']);
              expect(this.huntStateMock['#link'].guessers.error).toEqual(1);
              expect(this.huntStateMock['#link'].remaining).toEqual(4);
              expect(this.clientMock.action).not.toHaveBeenCalled();
              expect(this.batchManagerMock.addGuess).toHaveBeenCalled();
            });

            it("silently if 'good guess' notification is off", function () {
              this.propertiesMock.chat.feedback.mode.success = 0;
              this.getCommands().keyguess('#link', {username: 'error'}, [1]);

              expect(this.huntStateMock['#link'].guesses[0])
                                                  .toEqual(['bagu', 'error']);
              expect(this.huntStateMock['#link'].guessers.error).toEqual(1);
              expect(this.huntStateMock['#link'].remaining).toEqual(4);
              expect(this.clientMock.action).not.toHaveBeenCalled();
              expect(this.batchManagerMock.addGuess).not.toHaveBeenCalled();
            });

            it("and notifies chat if 'good guess' feedback is 'immediate'",
                function () {
              this.propertiesMock.chat.feedback.mode.success = 2;
              this.getCommands().keyguess('#link', {username: 'error'}, [1]);

              expect(this.huntStateMock['#link'].guesses[0])
                                                  .toEqual(['bagu', 'error']);
              expect(this.huntStateMock['#link'].guessers.error).toEqual(1);
              expect(this.huntStateMock['#link'].remaining).toEqual(4);
              expect(this.clientMock.action).toHaveBeenCalled();
              expect(this.batchManagerMock.addGuess).not.toHaveBeenCalled();
            });
          });
        });

        describe("that has not been guessed before, records the guess",
            function () {
          beforeEach(function () {
            this.huntStateMock['#link'].remaining = 5;
          });

          it("and, by default, batches a notification", function () {
            this.getCommands().keyguess('#link', {username: 'error'}, [1]);

            expect(this.huntStateMock['#link'].guesses[0]).toEqual(['error']);
            expect(this.huntStateMock['#link'].guessers.error).toEqual(1);
            expect(this.huntStateMock['#link'].remaining).toEqual(4);
            expect(this.clientMock.action).not.toHaveBeenCalled();
            expect(this.batchManagerMock.addGuess).toHaveBeenCalled();
          });

          it("silently if 'good guess' notification is off", function () {
            this.propertiesMock.chat.feedback.mode.success = 0;
            this.getCommands().keyguess('#link', {username: 'error'}, [1]);

            expect(this.huntStateMock['#link'].guesses[0]).toEqual(['error']);
            expect(this.huntStateMock['#link'].guessers.error).toEqual(1);
            expect(this.huntStateMock['#link'].remaining).toEqual(4);
            expect(this.clientMock.action).not.toHaveBeenCalled();
            expect(this.batchManagerMock.addGuess).not.toHaveBeenCalled();
          });

          it("and notifies chat if 'good guess' feedback is 'immediate'",
              function () {
            this.propertiesMock.chat.feedback.mode.success = 2;
            this.getCommands().keyguess('#link', {username: 'error'}, [1]);

            expect(this.huntStateMock['#link'].guesses[0]).toEqual(['error']);
            expect(this.huntStateMock['#link'].guessers.error).toEqual(1);
            expect(this.huntStateMock['#link'].remaining).toEqual(4);
            expect(this.clientMock.action).toHaveBeenCalled();
            expect(this.batchManagerMock.addGuess).not.toHaveBeenCalled();
          });
        });
      });
    });

    describe("if guessing isn't open", function () {
      beforeEach(function () {
        this.huntStateMock['#link'].isOpen = false;
      });

      it("doesn't record the guess", function () {
        this.getCommands().keyguess('#link', {username: 'impa'}, [1]);
        expect(this.huntStateMock['#link'].guesses.length).toEqual(0);
        expect(this.huntStateMock['#link'].guessers).toEqual({});
        expect(this.clientMock.say).toHaveBeenCalled();
      });

      it("is silent if 'bad guess' feedback is turned off", function () {
        this.propertiesMock.chat.feedback.mode.failure = 0;
        this.getCommands().keyguess('#link', {username: 'impa'}, [1]);
        expect(this.huntStateMock['#link'].guesses.length).toEqual(0);
        expect(this.huntStateMock['#link'].guessers).toEqual({});
        expect(this.clientMock.say).not.toHaveBeenCalled();
      });
    });
  });

  describe(".keyclose()", function () {
    beforeEach(function () {
      this.huntStateMock['#link'] = {
        isOpen : true
      , guesses : [['link'], undefined, ['ruto']]
      , guessers : {
          'link': 1
        , 'ruto': 3
        }
      , remaining : 3
      };
      this.huntStateMock['#zelda'] = {
        isOpen : true
      , guesses : [undefined, ['ganon'], undefined, ['impa']]
      , guessers : {
          'ganon': 2
        , 'impa': 4
        }
      , remaining : 3
      };
    });

    it("suspends guessing", function () {
      this.getCommands().keyclose('#link', {username: 'zelda', mod: true});
      expect(this.huntStateMock['#link'].isOpen).toBeFalsy;
    });

    it("preserves guess state", function () {
      this.getCommands().keyclose('#link', {username: 'zelda', mod: true});
      expect(this.huntStateMock['#link'].guesses).toEqual(
                                              [['link'], undefined, ['ruto']]);
      expect(this.huntStateMock['#link'].guessers).toEqual(
                                                       {'link': 1, 'ruto': 3});
      expect(this.huntStateMock['#link'].remaining).toEqual(3);
    });

    it("doesn't affect other channels", function () {
      this.getCommands().keyclose('#link', {username: 'zelda', mod: true});
      expect(this.huntStateMock['#zelda'].isOpen).toBeTruthy;
    });

    it("only works for mods", function () {
      this.getCommands().keyclose('#link', {username: 'ganon'});
      expect(this.huntStateMock['#link'].isOpen).toBeTruthy;
    });
  });

  describe(".keyfound()", function () {
    beforeEach(function () {
      this.huntStateMock['#link'] = {
        guesses : []
      , guessers : {}
      , remaining : 5
      };
    });

    it("tells chat the winning location", function () {
      this.getCommands().keyfound(
                    '#link', {username: 'zelda', mod: true}, [3]);
      expect(this.clientMock.say).toHaveBeenCalledWith(
                    '#link', jasmine.stringMatching(/found in location 3/), 2);
    });

    it("tells chat if nobody won", function () {
      this.getCommands().keyfound(
                          '#link', {username: 'zelda', mod: true}, [3]);
      expect(this.clientMock.say).toHaveBeenCalledWith(
                          '#link', jasmine.stringMatching(/nobody wins/), 2);
    });

    it("reports points if multiguess is on", function () {
      this.huntStateMock['#link'].guesses[2] =
                     ['arghus', 'kholdstare', 'armos', 'moldorm', 'mothula'];
      this.getCommands().keyfound(
                       '#link', {username: 'zelda', mod: true}, [3]);
      expect(this.clientMock.say).toHaveBeenCalledWith(
                '#link', jasmine.stringMatching(/7 points for arghus/), 2);
      expect(this.clientMock.say).toHaveBeenCalledWith(
                '#link', jasmine.stringMatching(/3 points for kholdstare/), 2);
      expect(this.clientMock.say).toHaveBeenCalledWith(
                '#link', jasmine.stringMatching(/1 points for armos/), 2);
      expect(this.clientMock.say).toHaveBeenCalledWith('#link', 
         jasmine.stringMatching(/honorable mention for moldorm, mothula/), 2);
    });

    it("has configurable point values ", function () {
      this.propertiesMock.scoring.points = '4,3,2,1';
      this.huntStateMock['#link'].guesses[2] =
                     ['arghus', 'kholdstare', 'armos', 'moldorm', 'mothula'];
      this.getCommands().keyfound(
                       '#link', {username: 'zelda', mod: true}, [3]);
      expect(this.clientMock.say).toHaveBeenCalledWith(
                '#link', jasmine.stringMatching(/4 points for arghus/), 2);
      expect(this.clientMock.say).toHaveBeenCalledWith(
                '#link', jasmine.stringMatching(/3 points for kholdstare/), 2);
      expect(this.clientMock.say).toHaveBeenCalledWith(
                '#link', jasmine.stringMatching(/2 points for armos/), 2);
      expect(this.clientMock.say).toHaveBeenCalledWith(
                '#link', jasmine.stringMatching(/1 points for moldorm/), 2);
      expect(this.clientMock.say).toHaveBeenCalledWith('#link', 
         jasmine.stringMatching(/honorable mention for mothula/), 2);
    });

    it("reports a winer if multiguess is off", function () {
      this.propertiesMock.scoring.multiguess = false;
      this.huntStateMock['#link'].guesses[2] = ['tetra'];
      this.getCommands().keyfound(
                       '#link', {username: 'zelda', mod: true}, [3]);
      expect(this.clientMock.say).toHaveBeenCalledWith(
                       '#link', jasmine.stringMatching(/winner is tetra/), 2);
    });

    it("only works for mods", function () {
      this.getCommands().keyfound('#link', {username: 'ganon'}, [3]);
      expect(this.clientMock.say).not.toHaveBeenCalled();
    });
  });
});
