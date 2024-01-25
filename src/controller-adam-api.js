// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
// //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const ad = require('./abstract-driver.js')
const db = require('./database.js')
const bkup = require('./backup.js')
const ui = require('./ui.js')
const adam = require('./adam-4019f.js')
const superagent = require('superagent')
const Controller = require('./node-pid.js')

class ControlAdam {
  constructor({ address = '192.12.3.221',
    ID = '01',
    testFlag = false,
    services,
    server,
    configPath,
  }) {
    this.Address = { value: address } // added, capitalized and wrapped for backup.js/database.js
    this.ID = new ui.ShowUser({ value: ID })
    this.configPath = configPath
    this.retryNumber = 0
    this.hidden = {
      processValue: [new ad.DataPoint({ value: 0, units: 'C' }), new ad.DataPoint({ value: 0, units: 'in' }), new ad.DataPoint({ value: 0, units: 'gal' })],
      setPoint: [new ad.DataPoint({ value: 0, units: 'C' }), new ad.DataPoint({ value: 0 }), new ad.DataPoint({ value: 0 })],
      controllerOutput: [new ad.DataPoint({ value: 0, units: '0-1' }), new ad.DataPoint({ value: 0 }), new ad.DataPoint({ value: 0 })],
      enable: false,
    }

    this.services = services
    this.server = server

    this.numberPVs = 3
    this.numberSPs = 1

    this.lockRefreshInterval = true
    this.maxRefreshInterval = 300

    this.loopInterval = 2000

    this.updateInterval = 7000
    this.lastUpdateTime = Date.now()

    this.ctr = new Controller({
      kp: -0.000_000_009_35,
      ki: 0.005,
      kd: 0,
      dt: this.loopInterval, // milliseconds
      outMin: 0,
      outMax: 1,
    })
    this.AdditionalFields = {
      // Enable: new ui.ShowUser({value: false, type: ['output', 'binary']}),
    }
    Object.defineProperty(this.AdditionalFields, 'Enable', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({ value: this.hidden.enable, type: ['output', 'binary'] })
      },
      set: val => {
        if (val === false) {
          // set the duty to 0 to prevent things from getting hot
          this.utilityDuty(0)
        }

        this.hidden.enable = val
      },
    })
    if (this.configPath !== undefined) {
      this.AdditionalFields.Database = new ui.ShowUser({
        value: [{
          id: 'Settings',
          obj: {
            0: new db.GUI({
              measurementName: 'adam_humidifier_basic',
              fields: ['SP0',
                'PV0',
                'CO0',
                'PV1',
                'PV2'],
              obj: this,
              testFlag: this.testFlag,
              objPath: this.configPath,
            })
          },
          path: this.configPath + '/' + db.path + '/' + bkup.fileName(this) + '.json',
        }],
        type: ['output', 'link'],
      })
      this.getStaticSettings()
    }

    Object.defineProperty(this.AdditionalFields, 'k_p', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({ value: this.ctr.kp, type: ['output', 'number'] })
      },
      set: val => {
        this.ctr.kp = val
      },
    })
    Object.defineProperty(this.AdditionalFields, 'k_i', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({ value: this.ctr.ki, type: ['output', 'number'] })
      },
      set: val => {
        this.ctr.ki = val
      },
    })
    Object.defineProperty(this.AdditionalFields, 'k_d', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({ value: this.ctr.kd, type: ['output', 'number'] })
      },
      set: val => {
        this.ctr.kd = val
      },
    })

    setInterval(this.controlLoop.bind(this), this.loopInterval) // loop interval hard-coded for now
  }

  getStaticSettings() {
    var cMap = bkup.load(this.configPath)
    console.log('Loaded controller map')
    console.log(cMap)
    if (Object.prototype.hasOwnProperty.call(cMap, this.ID.value)) {
      var thisObj = cMap[this.ID.value]
      console.log('Loading static settings')
      console.log(thisObj)
      if (Object.prototype.hasOwnProperty.call(thisObj, 'k_p')) this.ctr.kp = thisObj.k_p.value
      if (Object.prototype.hasOwnProperty.call(thisObj, 'k_i')) this.ctr.ki = thisObj.k_i.value
      if (Object.prototype.hasOwnProperty.call(thisObj, 'k_d')) this.ctr.kd = thisObj.k_d.value
    }
  }

  controlLoop() {
    this.hidden.controllerOutput[0].value = this.ctr.update(this.PV0.value)
    this.hidden.controllerOutput[0].time = Date.now()
    if (this.AdditionalFields.Enable.value) {
      this.utilityDuty(this.hidden.controllerOutput[0].value)
    }
  }

  utilityDuty(val) {
    console.log('Updating PWM to:', val)
    if (!this.testFlag && (Date.now() - this.lastUpdateTime >= this.updateInterval)) {
      this.lastUpdateTime = Date.now()
      superagent.post(this.Address.value + '/api/Valves/02/Valve 0 Duty')
      .send(val.toString())
      .then(res => {
        console.log('Response')
        if (res.statusCode === 200) {
          console.log(res.text)
          // var mi = JSON.parse(res.text)
          // console.log(mi)
          // this.hidden.processValue[1] = mi
        }
      })
      .catch(error => {
        console.log('adam-api utilityDuty error')
        console.error(error)
      })
    }
  }

  findSubObj(callkey, obj) {
    var retObj
    // console.log('find subobj')
    if (obj === undefined) {
      return undefined
    }

    Object.entries(obj).forEach(([key, value]) => {
      // console.log(key)
      if (callkey === key) {
        retObj = value
      }
    })
    return retObj
  }

  postVal(call, val) {
    var callParts = call.split('/')
    if (this.testFlag) console.log(callParts)
    // callParts[0] == 'api'
    var topObj
    // var path
    var serviceIndex
    this.services.forEach((item, i) => {
      if (this.testFlag) console.log(item.id)
      if (item.id === callParts[1]) {
        serviceIndex = i
        topObj = item.obj
        // path = item.path
      }
    })
    if (this.testFlag) console.log(topObj)
    var componentObj = this.findSubObj(callParts[2], topObj) // e.g. valves -> 0
    if (this.testFlag) console.log(componentObj)
    var paramObj = this.findSubObj(callParts[3], componentObj) // e.g. valves -> 0 -> State
    if (this.testFlag) console.log(paramObj)
    if (paramObj === undefined) {
      console.log('Invalid API call!')
      console.log('NOT EXECUTING!')
      console.log(call)
      console.log(val)
      return
    }

    if (this.server) {
      this.server.handlePost({
        key: callParts[2],
        value: componentObj,
        subkey: callParts[3],
        subvalue: paramObj,
        service: this.services[serviceIndex],
        body: val,
        res: {
          send: () => { },
          json: () => { },
          status: () => {
            console.log('Mode Post Error')
            return {
              send: error => {
                console.log(error)
              },
            }
          },
        },
        basePath: '', // note: this would need to be filled in to use links
      })
    }
  }

  get CO0() {
    return this.hidden.controllerOutput[0]
  }

  get SP0() {
    return this.hidden.setPoint[0]
  }

  set SP0(val) {
    this.hidden.setPoint[0].value = val
    this.ctr.setTarget(val)
    this.hidden.setPoint[0].time = Date.now()
  }

  get PV0() {
    if (Date.now() - this.hidden.processValue[0].time < this.maxRefreshInterval && this.lockRefreshInterval) {
      return this.hidden.processValue[0]
    }
    superagent.get(this.Address.value + '/api/Controllers/' + this.ID.value + '/Process Value 3')
      .then(res => {
        console.log('Response')
        if (res.statusCode === 200) {
          // console.log(res.text)
          var mi = JSON.parse(res.text)
          console.log(mi.value)
          var dp = mi.value
          this.hidden.processValue[0].value = dp.value
          this.hidden.processValue[0].time = dp.time
          this.hidden.processValue[0].units = dp.units

        }
      })
      .catch(error => {
        if (this.testFlag) {
          this.hidden.processValue[0].value = -1
          this.hidden.processValue[0].units = '˚C'
          this.hidden.processValue[0].time = Date.now()
        } else {
          console.log('adam-api error')
          console.error(error)
        }
      })
    return this.hidden.processValue[0]
  }

  get PV1() {
    if (Date.now() - this.hidden.processValue[1].time < this.maxRefreshInterval && this.lockRefreshInterval) {
      return this.hidden.processValue[1]
    }

    superagent.get(this.Address.value + '/api/Controllers/' + this.ID.value + '/Process Value 1')
      .then(res => {
        console.log('Response')
        if (res.statusCode === 200) {
          // console.log(res.text)
          var mi = JSON.parse(res.text)
          console.log(mi.value)
          var dp = mi.value
          this.hidden.processValue[1].value = dp.value
          this.hidden.processValue[1].time = dp.time
          this.hidden.processValue[1].units = dp.units

        }
      })
      .catch(error => {
        if (this.testFlag) {
          this.hidden.processValue[1].value = -1
          this.hidden.processValue[1].units = '˚C'
          this.hidden.processValue[1].time = Date.now()
        } else {
          console.log('adam-api error')
          console.error(error)
        }
      })
    return this.hidden.processValue[1]
  }

  get PV2() {
    if (Date.now() - this.hidden.processValue[2].time < this.maxRefreshInterval && this.lockRefreshInterval) {
      return this.hidden.processValue[2]
    }

    superagent.get(this.Address.value + '/api/Controllers/' + this.ID.value + '/Process Value 2')
      .then(res => {
        console.log('Response')
        if (res.statusCode === 200) {
          // console.log(res.text)
          var mi = JSON.parse(res.text)
          console.log(mi.value)
          var dp = mi.value
          this.hidden.processValue[2].value = dp.value
          this.hidden.processValue[2].time = dp.time
          this.hidden.processValue[2].units = dp.units
        }
      })
      .catch(error => {
        if (this.testFlag) {
          this.hidden.processValue[2].value = -1
          this.hidden.processValue[2].units = '˚C'
          this.hidden.processValue[2].time = Date.now()
        } else {
          console.log('adam-api error')
          console.error(error)
        }
      })
    return this.hidden.processValue[2]
  }

  initialize() {
    // initialization done on separate system
  }
}

module.exports = {
  Device: ControlAdam,
}
