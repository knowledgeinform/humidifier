/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2019 The Johns Hopkins University Applied Physics Laboratory LLC (JHU/APL).  All Rights Reserved.
//
// This material may be only be used, modified, or reproduced by or for the U.S. Government pursuant to the license
// rights granted under the clauses at DFARS 252.227-7013/7014 or FAR 52.227-14. For any other permission, please
// contact the Office of Technology Transfer at JHU/APL: Telephone: 443-778-2792, Internet: www.jhuapl.edu/ott
//
// NO WARRANTY, NO LIABILITY. THIS MATERIAL IS PROVIDED 'AS IS.' JHU/APL MAKES NO REPRESENTATION OR WARRANTY WITH
// RESPECT TO THE PERFORMANCE OF THE MATERIALS, INCLUDING THEIR SAFETY, EFFECTIVENESS, OR COMMERCIAL VIABILITY, AND
// DISCLAIMS ALL WARRANTIES IN THE MATERIAL, WHETHER EXPRESS OR IMPLIED, INCLUDING (BUT NOT LIMITED TO) ANY AND ALL
// IMPLIED WARRANTIES OF PERFORMANCE, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT OF
// INTELLECTUAL PROPERTY OR OTHER THIRD PARTY RIGHTS. ANY USER OF THE MATERIAL ASSUMES THE ENTIRE RISK AND LIABILITY
// FOR USING THE MATERIAL. IN NO EVENT SHALL JHU/APL BE LIABLE TO ANY USER OF THE MATERIAL FOR ANY ACTUAL, INDIRECT,
// CONSEQUENTIAL, SPECIAL OR OTHER DAMAGES ARISING FROM THE USE OF, OR INABILITY TO USE, THE MATERIAL, INCLUDING,
// BUT NOT LIMITED TO, ANY DAMAGES FOR LOST PROFITS.
/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const pinMap = require('./pin-map.js')
const rpio = require('rpio')
const ui = require('./ui.js')
const bkup = require('./backup.js')
const db = require('./database.js')
const ad = require('./abstract-driver.js')

var utilitiesID = 'utilities'
var utilitiesPath = 'config/' + utilitiesID

class UtilityC {
  constructor({GPIO,
    UtilityNumber,
    Description,
    Details,
    testFlag,
    pwmMode = false,
    interval = 100,
    duty = 0.1,
  }) {
    this.Utility = new ui.ShowUser({value: UtilityNumber.toString()})
    Object.defineProperty(this, 'testFlag', {
      writable: true,
      value: testFlag,
    })
    this.GPIO = new ui.ShowUser({value: GPIO, type: ['output', 'number']})
    this.Description = new ui.ShowUser({value: Description})
    this.Details = new ui.ShowUser({value: Details})

    Object.defineProperty(this, 'hiddenInterval', {
      value: interval,
      writable: true,
    })
    Object.defineProperty(this, 'Interval', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: new ad.DataPoint({value: this.hiddenInterval, units: 'ms'}), type: ['output', 'datapoint']})
      },
      set: val => {
        this.hiddenInterval = val
        this.restartTimers()
      },
    })
    Object.defineProperty(this, 'hiddenDuty', {
      value: duty,
      writable: true,
    })
    Object.defineProperty(this, 'Duty', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: new ad.DataPoint({value: this.hiddenDuty, units: '(0-1)'}), type: ['output', 'datapoint']})
      },
      set: val => {
        if (val >= 0 && val <= 1) {
          this.hiddenDuty = val
          this.restartTimers()
        }
      },
    })

    Object.defineProperty(this, 'hiddenIntervalTimer', {
      value: undefined,
      writable: true,
    })
    Object.defineProperty(this, 'hiddenDutyTimer', {
      value: undefined,
      writable: true,
    })
    Object.defineProperty(this, 'hiddenPWMmode', {
      value: pwmMode,
      writable: true,
    })

    Object.defineProperty(this, 'PWM Mode', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.hiddenPWMmode, type: ['output', 'binary']})
      },
      set: val => {
        this.hiddenPWMmode = val
        if (this.hiddenPWMmode) {
          // start interval timer
          this.restartTimers()
        } else {
          // stop interval timer
          this.stopTimers()
        }
      },
    })

    Object.defineProperty(this, 'utilityState', {
      value: new ui.ShowUser({value: false, type: ['output', 'binary']}),
      writable: true,
    })
    Object.defineProperty(this, 'State', {
      enumerable: true,
      get: () => {
        return this.utilityState
      },
      set: val => {
        if (this.hiddenPWMmode) return

        console.log('Setting Utility ' + this.Utility.value.toString() + ' to ' + val.toString())
        var pinMapIndex = pinMap.getIndexFromGPIO(this.GPIO.value)
        if (val) {
          rpio.write(pinMap.HeaderNumber[pinMapIndex], rpio.HIGH)
        } else {
          rpio.write(pinMap.HeaderNumber[pinMapIndex], rpio.LOW)
        }

        this.utilityState.value = val
        console.log('Utility State')
        console.log(this.utilityState)
        if (this.testFlag) console.log('Utility: ' + this.Utility + ' ' + val + ' (GPIO ' + this.GPIO.value +
        ' Header: ' + pinMap.HeaderNumber[pinMapIndex] + ' Info: ' + pinMap.Name[pinMapIndex] + ')')
      },
    })
    this.datastreams = {refreshRate: 300}
    this.updateable = ['State']
    this.Database = new ui.ShowUser({
      value: [{
        id: 'Settings',
        obj: {0: new db.GUI({
          measurementName: 'utilities_pwm_basic',
          fields: ['State',
            'PWM Mode',
            'Interval',
            'Duty'],
          tags: ['Description'],
          obj: this,
          testFlag: this.testFlag,
          objPath: utilitiesPath,
        })},
        path: utilitiesPath + '/' + db.path + '/' + bkup.fileName(this) + '.json',
      }],
      type: ['output', 'link'],
    })
  }

  dutyOn() {
    var pinMapIndex = pinMap.getIndexFromGPIO(this.GPIO.value)
    var dutyLength = Math.round(this.hiddenInterval * this.hiddenDuty)
    if (dutyLength >= 1) {
      rpio.write(pinMap.HeaderNumber[pinMapIndex], rpio.HIGH)
      this.hiddenDutyTimer = setTimeout(this.dutyOff.bind(this), dutyLength)
    }
  }

  dutyOff() {
    var pinMapIndex = pinMap.getIndexFromGPIO(this.GPIO.value)
    rpio.write(pinMap.HeaderNumber[pinMapIndex], rpio.LOW)
  }

  startTimers() {
    this.hiddenIntervalTimer = setInterval(this.dutyOn.bind(this), this.hiddenInterval)
  }

  restartTimers() {
    this.stopTimers()
    if (this.hiddenPWMmode) {
      this.startTimers()
    }
  }

  stopTimers() {
    if (this.hiddenIntervalTimer !== undefined) {
      clearInterval(this.hiddenIntervalTimer)
    }

    if (this.hiddenDutyTimer !== undefined) {
      clearTimeout(this.hiddenIntervalTimer)
    }
  }
}

var utilityMap = {
  1: {GPIO: 2, UtilityNumber: 1, Description: '', Details: '', State: 0},
  2: {GPIO: 3, UtilityNumber: 2, Description: '', Details: '', State: 0},
}


function lookupPins(vMap) {
  var pins = []
  // console.log(typeof vMap)
  Object.entries(vMap).forEach(([, value]) => {
    pins.push(pinMap.HeaderNumber[pinMap.getIndexFromGPIO(value.GPIO)])
  })
  // console.log(pins)
  return pins
}

function pullDownPins() {
  var pins = lookupPins(utilityMap)
  // var state = rpio.PULL_DOWN
  for (var pin of pins) {
    /* Configure pin as output with the initiate state set low */
    rpio.open(pin, rpio.OUTPUT, rpio.LOW)
  }
}

module.exports = {
  initialize: function (test) {
    // test = true
    return new Promise(resolve => {
      // test = false
      console.log('intializing utilities')
      console.log(test)
      // intialize pins
      this.pinInit(test)

      // initialize modes
      // state.on('Mode1',mode1Settings)
      // state.on('Mode2',mode2Settings)
      // state.on('Mode3',mode3Settings)
      // state.on('Mode4',mode4Settings)

      if (bkup.configExists(utilitiesPath)) {
        // this should eventually be in a try-catch with a default config
        var loadMap = bkup.load(utilitiesPath)
        Object.entries(loadMap).forEach(([key, value]) => {
          // specify bare-minimum amount that the config should have
          if (value.GPIO.value) {
            // console.log(key)
            if (utilityMap[key]) {
              // just overwrite it
              console.log('overwriting it')
            } else {
              // add the key
              console.log('Adding it')
            }

            // console.log(value)
            utilityMap[key] = new UtilityC({
              GPIO: value.GPIO.value,
              UtilityNumber: value.Utility.value,
              Description: value.Description.value,
              Details: value.Details.value,
              State: value.State.value,
              pwmMode: value['PWM Mode'].value,
              interval: value.Interval.value.value,
              duty: value.Duty.value.value,
            })
            // utilityMap[key] = new MFC({id: value.ID.value,router: router, testFlag: test,Description: value.Description.value,Details: value.Details.value})
          } else {
            // did not have bare minimum so fail out loudly
            console.log('Configuration missing critical component(s):')
            console.log('value.GPIO.value')
            console.log(value)
          }
        })
      } else {
        // add details to utility map
        Object.entries(utilityMap).forEach(([key, value]) => {
          var pinMapIndex = pinMap.getIndexFromGPIO(utilityMap[key].GPIO)
          value.Details = 'GPIO ' + utilityMap[key].GPIO + ' Header: ' + pinMap.HeaderNumber[pinMapIndex] + ' Info: ' + pinMap.Name[pinMapIndex]
          utilityMap[key] = new UtilityC({
            GPIO: value.GPIO,
            UtilityNumber: value.UtilityNumber,
            Description: value.Description,
            Details: value.Details,
            State: value.State,
            pwmMode: false,
            interval: 500,
            duty: 0,
          })
          // console.log(value)
          bkup.save(utilityMap[key], utilitiesPath)
        })
      }

      console.log('utilitymap')
      console.log(utilityMap)
      return resolve()
    })
  },
  pinInit: function (test) {
    if (test) {
      console.log('Operating in test-mode')
      /*
       * Explicitly request mock mode to avoid warnings when running on known
       * unsupported hardware, or to test scripts in a different hardware
       * environment (e.g. to check pin settings).
       */
      rpio.init({mock: 'raspi-3'})

      /* Override default warn handler to avoid mock warnings */
      rpio.on('warn', function () {})
    } else {
      rpio.init({gpiomem: false})
    }

    pullDownPins()
  },
  id: utilitiesID,
  obj: utilityMap,
  path: utilitiesPath,
  Utility: UtilityC,
}
