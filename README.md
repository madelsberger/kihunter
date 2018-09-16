# kihunter

kihunter is a simple stand-alone bot that runs the Ganon's Tower key guessing
game for ALttP Randomizer in Twitch chat.

## Requirements

As it is built on tmi.js, kihunter runs on node.js 4.4 or higher, and of 
course requires a network connection that can reach Twitch chat.  

kihunter will need a twitch account to log into.  All commands can function
without any special privilege (sub, mod, etc.).  That said, various anti-spam
measures may be more relaxed if kihunter uses a more privileged account.
Depending on chat volume during the guessing period, if kihunter malfunctions,
it may be necessary to adjust its configuration (e.g. by reducing its feedback
level) and/or increase the privilege of its account in the channel.

## Installation

The simplest way to install is via npm.

    npm install --global @madelsberger/kihunter

Alternately, you can visit the project's 
[github page](https://github.com/madelsberger/kihunter).  (After a manual
installation, kihunter will still require some other npm modules, however.)

## Configuration

Options are defined in a configuration file.  You can specify the file to
use as a command-line argument when launching kihunter (see below); or
by default it will look for `kihunter.properties` in the current directory.

### `[tmijs]` section

This is the only section where configuration is *reuqired*, as the properties
tell kihunter how to connect to Twitch and they have no defaults.

* **identity.username** : the name of the Twitch account kihunter will use
* **identity.password** : an oauth token belonging to the specified account;
  you can get a suitable token using the tool at http://twitchapps.com/tmi/
* **channels** : one or more channels (comma-separated) whose chat kihunter
  should monitor. When monitoring multiple channels, the game is run
  independently in each channel.

### `[core]` section

* **locationcount** (default `22`) : the number of guessable locations; this
  should be 22, but who knows what they'll randomize next?

* **maintainers** : a list of twitch users who can whisper special commands
  to the account hosting kihunter.  These are typically for diagnostic
  purposes.
  In previous versions, there have been whisper commands that would bypsass
  the checks that limit certain commands to "mods only".  Currently there are
  none, but they could be re-added if it's found that they would provide an
  ongoing testing benefit.  Because kihunter doesn't perform any mod-level
  actions, this shouldn't pose any major security risk, but it would allow
  someone to disrupt the key game; so except when someone is actively testing
  kihunter with this capability, this list should usually be empty.

### `[scoring]` section

You can adjust how the game is scored.

* **multiguess** (default `true`) : Determines if multiple guesses will be
  accepted for each location, with points awarded based on who guessed the
  correct location 1st, 2nd, etc.; or whether there will be a single
  definitive winner.
  By default all valid guesses are accepted, and points are awarded based on
  the order of correct guesses (see *points* option, below).  If *multiguess*
  is set to `false`, kihunter will reject all but the first guess for each
  location, and will declare an undisputed winner at the end of the game
  (assuming anyone guesses correctly); but once all locations are claimed,
  guessing is automatically closed. 

* **points** (default `7, 3, 1`) : In *multiguess* mode, this determines the
  points awarded for each correct guess.  The first correct guess is awarded
  points equal to the first value, and so on.  If there are more correct
  guesses than specified values, the remaining guessers get "honorable
  mention".  At this time the points do nothing and are not tracked.

### `[chat]` section

You can control kihunter's behavior in the channels' chat.

* **commandprefix** (default: `!`) : a single-character prefix for commands
  recognized by kihunter.  Chat messages will be considered as possible
  commands only if their first character is the command prefix.

kihunter limits its outbound traffic to avoid problems with anti-spamming
measures.  You can influence those limits:

* **expectmod** (default false) : This indicates whetehr kihunter is running on
  an account with mod privileges on the channel(s) it monitors.  While kihunter
  does not use moderator abilities, when run as mod it can safely send more
  messages.  If you want to enable more frequent messages from kihunter during
  high-volume periods of open guessing, you can set this to `true`; but *if the
  bot isn't actually running under a mod account, it will likely end up
  getting disconnected by tmi, potentially limiting access to chat from the
  computer where kihunter is running.*

You can specify if/how `keyguess` commands should be acknowledged.  During the
period of open guessing, kihunter may receive a high volume of commands
(depending on number of viewers in chat), and these may arrive rapidly.

As noted above, kihunter limits the rate at which it sends messages.  While
you can relax the limit some when running the bot as a mod, excessive traffic
can still negatively affect the chat's experience.

* **feedback.mode.success** (default `1`) : how to respond to accepted guesses
  * 0 : do not provide feedback.  This is the safest option for channels
    that anticipate high guess volumes
  * 1 : provide batched feedback ; i.e. send periodic updates telling the
    chat who has successfully recorded a guess.  Updates will be sent
    throughout the period while guessing is open.
  * 2 : send immediate feedback for each guess, addressed to the user who
    placed the guess.  This runs the highest risk of triggering anti-spam
    measures.
* **feedback.mode.failure** (default `2`) : how to respond to rejected guesses.
  It is likely that the volume of invalid guesses will be relatively low,
  especially in multiguess mode, so this can be configured separately.  Note
  that there is no "batch" option for failure messages, as this would not be
  useful.  Also note that regardless of this setting, feailure messages may be
  dropped during periods of high traffic.
  * 0 : do not provide feedback.  When `multiguess` is false, or if volume of
    invalid guesses is too high for whatever reason, this is the "safest"
    setting.
  * 2 : send immediate feedback to each failed request. 

For *feedbackMode* `1`, you can control how batch messages are sent. The
*interval.x* parametrs establish a range of possible intervals, and the exact
timing depends on the volume of guesses. (This balances messages frequency
against message length.)

* **feedback.batch.interval.min** (default 5) : under no circumstances will the
  bot send batch messages more frequently than every *min* seconds
* **feedback.batch.interval.max** (default 30) : a batch message will be sent
  every *max* seconds during open guessing, even if no new guesses have been
  received

* **feedback.batch.length** (default 450) : The longest you want a single
  batched message to be.  As the number of guesses to be reported in the next
  batch increases, the message length will increase.  The closer to max
  length the message gets, the closer to the min interval (instead of the max
  interval) the next batch will be sent.  If the message length would exceed
  the maximum length, then some guesses will be held back for the next batch.
  The minimum value for this parameter is 100; if you try to set a lower value
  then 100 will be used instead.
  Messages above a certain length (current testing suggests ~480) may not be
  rendered accurately in chat; if long batch messages become garbled, try
  lowering *feedback.batch.length*.

## Usage

Once you've completed the above steps, you're ready to launch kihunter.  If
you used npm to install the package globally, then at a command prompt you
can just type

    kihunter [<config-file>]

where `<property-file>`, if provided, is the path to a file containing the
configuration values.

Alternately, you can launch it explicitly

    node <path/to/kihunter.js> [<config-file>]

kihunter will then log in using the supplied twitch identity, and will listen
for chat commands from the channels listed in `opts.channels` as well as
whispers from users named in *maintainers*.

### Chat Commands

A channel's mods (and/or broadcaster) can use the following commands in chat
(remember to prepend the configured *commandPrefix*):

* **keyreset** : start a new key location guessing game in the channel.  If a
  game was in progress on the channel, it will be aborted - i.e. guessing will
  be closed and all prior guesses will be discarded.  This could be used at
  the beginning of a seed, for example, to make sure kihunter is in the proper
  starting state, but it usually isn't needed.

* **keyopen** : begin accepting guesses for the channel's current game.  When
  kihunter first launches (or after a reset), guesses are not immediately
  accepted.  Tyipcally a mod would issue the *keyopen* cmmmand when the runner
  collects the final crystal for the seed.

  This comamnd does nothing when guessing is already open.  If *multiguess*
  mode is `false` and all locations have been guessed, then guessing is
  auto-closed and cannot be reopened for the channel's current game.

* **keyclose** : suspend accepting guesses on the channel, but without
  aborting the current game.  For example, if Sakura Tsubasa softlocks the
  game while trying to enter Ganon's Tower and loses all progress back to the
  2nd crystal, her mods might suspend guesses while she recovers the lost
  progress and then re-open guessing (with *keyopen*) once she regains the
  last crystal.

* **keyfound `<#>`** (where `<#>` is an integer between 1 and 
  *locationCount*, inclusive) : End the game and declare the winner(s)!
  Anyone who guessed the specified location will be recognized.  This will
  automatically close guessing and reset to prepare for the next game.

Anyone in chat can issue the following commands:

* **keyguess `<#>`** (where `<#>` is an integer between 1 and
  *locationCount*, inclusive) : Guess that the key will be found in location
  `<#>`.  kihunter will only take one guess per user per game, and may reject
  duplicate guesses (if *multiguess* is `false`).  Guesses will only be
  accepted when guessing is open (see *keyopen* and *keyclose*).

* **keylist** : Show which locations, if any, nobody has guessed; this
  command has a built-in 5 second cooldown

### Whisper Commands

If any users are listed in *maintainers*, they can whisper the following
commands to the account kihunter is logged into.  These are generally for
diagnostic purposes. 

* **logstate** : On the local console log, record informatino about the 
  current guessing game state in each channel kihunter is monitoring.

* **sudo `<channel>` `<suname>` `<command>` `[<params> ...]`** : Execute
  the specified `<command>`(with the specified `<params>`, if any) in the
  specified `<channel>`; beahve as though the command had been sent in chat
  by a non-mod user named `<suname>`.
  This may be useful to set up test scenarios with specific combinations of
  guesses, for example.

* **spamguess `<channel>` `<count>`** : Behave as though `<channel>`'s chat
  sent `<count>` *keyguess* commands (each from a different user) in rapid
  succession.  This is for stress-testing (e.g. to make sure the feedback
  settings will work well on your channel).
