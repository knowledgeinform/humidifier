humidifier
==========



[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/humidifier.svg)](https://npmjs.org/package/humidifier)
[![Downloads/week](https://img.shields.io/npm/dw/humidifier.svg)](https://npmjs.org/package/humidifier)
[![License](https://img.shields.io/npm/l/humidifier.svg)](https://github.com/humidifier/humidifier/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->

Run all commands in the 'src' folder (a.k.a. humidifier/src) because the config
folder is in this directory

```sh-session
$ npm install
$ cd src
$ node ../bin/run COMMAND
running command...
$ node ../bin/run (-v|--version|version)
humidifier/0.0.0 darwin-x64 node-v13.10.1
$ node ../bin/run --help [COMMAND]
USAGE
  $ node ../bin/run COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`node ../bin/run server [PORT]`](#humidifier-server)
* [`node ../bin/run hello`](#humidifier-hello)
* [`node ../bin/run help [COMMAND]`](#humidifier-help-command)

## `node ../bin/run server`

Starts the server that runs the REST API. The front-end GUI is available in test
mode on localhost:3000 (default port), otherwise localhost:PORT. Change the
address in src/server.js, var ipAddress to run the server on a different address
in production mode (without the -t option).

```
USAGE
  $ node ../bin/run server

ARGUMENTS
  PORT  the port to have the server run on (default: 3000)

OPTIONS
  -t, --test  runs the server in test mode (address: localhost)

DESCRIPTION
  ...
  Currently the API is available on, for example, localhost:3000/api/
  HTTP GET calls are used recursively to find everything on the server.

  For example,
  HTTP GET localhost:3000/api/   Returns JSON [service1, service2, etc.]
  HTTP GET localhost:3000/api/service1   Returns JSON [subservice1, subservice2,  etc.]
  HTTP GET localhost:3000/api/service1/subservice1   Returns JSON {property: value, etc.}

  To minimize bandwidth usage, many of the properties themselves can be
  independently GET'd

  For example,
  HTTP GET localhost:3000/api/MFCs/A/Set%20Point  Returns the current set-point
  as a JSON structure {}

  Any 'value' that has a 'type: ['output', 'something']' can be changed with
  an HTTP POST command

  For example
  HTTP POST localhost:3000/api/MFCs/A/Set%20Point 3  Changes the set-point of
  MFC A to be 3 in whatever units are indicated by the structure
```

Post with curl Shell example:
```sh-session
  $ curl -d "3" http://localhost:3000/api/MFCs/A/Set%20Point
  # changes MFC A's setpoint to 3 (in '-t' mode, this doesn't do anything)
  # to see a change in the test-mode, try changing the 'Details' property
  $ curl -d "New Details" http://localhost:3000/api/MFCs/A/Details
  # this will set the 'Details' property to be 'New Details'
```

Oclif command
_See code: [src/commands/server.js](https://gitlab.jhuapl.edu/jonesjp1/humidifier/-/tree/master/src/commands/server.js)_
Actual routines
_See code: [src/server.js](https://gitlab.jhuapl.edu/jonesjp1/humidifier/-/tree/master/src/server.js)_

## `node ../bin/run hello`

Describe the command here

```
USAGE
  $ node ../bin/run hello

OPTIONS
  -n, --name=name  name to print

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [src/commands/hello.js](https://gitlab.jhuapl.edu/jonesjp1/humidifier/-/tree/master/src/commands/hello.js)_

## `node ../bin/run help [COMMAND]`

display help for humidifier

```
USAGE
  $ node ../bin/run help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.0/src/commands/help.ts)_
<!-- commandsstop -->
