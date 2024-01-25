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

// hello world
// manufacturer: 'Digi International'
//  constructor({portPath, testFlag=true, baud=9600, timing=false, maxQueueLength=100, delimiter='\r', manufacturer, seriallineSerial}) {

const ad = require('./abstract-driver.js')
const Controller = require('./node-pid.js')
const {Telnet} = require('telnet-client')
const ui = require('./ui.js')
const db = require('./database.js')
const bkup = require('./backup.js')
const fsPromises = require('fs/promises')

class HumidityClass {
  constructor({testFlag = false,
    services,
    serverInstance,
    router = '192.12.3.146',
    restartWait = 1000 * 60 * 60 * 4,
    humidityDriverPath,
    server,
    index,
  }) {
    testFlag = false
    server = serverInstance
    this.ID = new ui.ShowUser({value: router}) // for database backup purposes
    this.index = index
    this.humidityDriverPath = humidityDriverPath
    this.server = server
    this.restartWait = restartWait // restart Vaisala connection to hopefully 'fix' the timeout issue
    this.testFlag = testFlag
    this.services = services
    this.dflow = 0
    this.CO0 = new ad.DataPoint({units: 'SLPM'})
    this.hflow = 0
    this.numberPVs = 8
    this.numberSPs = 2
    this.PV0 = new ad.DataPoint({value: 0, units: 'g/m3'}) // process variable
    this.PV1 = new ad.DataPoint({value: this.dflow + this.hflow, units: 'SLPM'}) // process variable
    this.PV2 = new ad.DataPoint({value: 0, units: '%RH'}) // % relative humidity
    this.PV3 = new ad.DataPoint({value: 0, units: 'C'}) // Temperature
    this.PV4 = new ad.DataPoint({value: 0, units: 'ppmv'}) // humid air volume
    this.PV5 = new ad.DataPoint({value: 0, units: 'hPa'}) // water vapor pressure
    this.PV6 = new ad.DataPoint({value: 0, units: 'C'}) // saturation temperature
    this.PV7 = new ad.DataPoint({value: 0, units: 'hPa'}) // saturation pressure
    this.ctr = new Controller({
      kp: -9.35e-9,
      ki: 0.005,
      kd: 0,
      dt: 1000, // milliseconds
      outMin: 0,
      outMax: 2000, // changed whenever SP1 changes
    })
    this.hSP0 = new ad.DataPoint({value: 0, units: 'g/m3'})
    Object.defineProperty(this, 'SP0', {
      enumerable: true,
      get: () => {
        return this.hSP0
      },
      set: val => {
        this.hSP0.value = val
        this.hSP0.time = Date.now()
        this.ctr.setTarget(this.hSP0.value)
      },
    })
    this.hSP1 = new ad.DataPoint({value: 200, units: 'SLPM'})
    Object.defineProperty(this, 'SP1', {
      enumerable: true,
      get: () => {
        return this.hSP1
      },
      set: val => {
        this.hSP1.value = val
        this.ctr.outMax = val // decreases integral wind-up
        this.hSP1.time = Date.now()
      },
    })

    this.ctr.setTarget(this.hSP0.value) // % Relative Humidity
    this.checkInterval = 6000 // interval (ms) to wait before checking lastRead
    this.params = {
      host: router,
      port: 23,
      negotiationMandatory: false,
      loginPrompt: 'HMT330 / 5.16',
      timeout: Math.round(this.checkInterval / 2),
    }
    this.connection = new Telnet()
    this.lastRead = Date.now()
    this.AdditionalFields = {Enable: new ui.ShowUser({value: false, type: ['output', 'binary']})}
    if (this.humidityDriverPath !== undefined) {
      this.AdditionalFields.Database = new ui.ShowUser({
        value: [{
          id: 'Settings',
          obj: {0: new db.GUI({
            measurementName: 'humidity_basic_ext',
            fields: ['SP0',
              'PV0',
              'CO0',
              'SP1',
              'PV1',
              'PV2',
              'PV3',
              'PV4',
              'PV5',
              'PV6',
              'PV7'],
            obj: this,
            testFlag: this.testFlag,
            objPath: this.humidityDriverPath,
          })},
          path: this.humidityDriverPath + '/' + db.path + '/' + bkup.fileName(this) + '.json',
        }],
        type: ['output', 'link'],
      })
      this.getStaticSettings()
    }

    Object.defineProperty(this.AdditionalFields, 'k_p', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.ctr.kp, type: ['output', 'number']})
      },
      set: val => {
        this.ctr.kp = val
      },
    })
    Object.defineProperty(this.AdditionalFields, 'k_i', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.ctr.ki, type: ['output', 'number']})
      },
      set: val => {
        this.ctr.ki = val
      },
    })
    Object.defineProperty(this.AdditionalFields, 'k_d', {
      enumerable: true,
      get: () => {
        return new ui.ShowUser({value: this.ctr.kd, type: ['output', 'number']})
      },
      set: val => {
        this.ctr.kd = val
      },
    })
    // this.initialize()
  }

  getStaticSettings() {
    var cMap = bkup.load(this.humidityDriverPath)
    console.log('Loaded controller map')
    console.log(cMap)
    if (Object.prototype.hasOwnProperty.call(cMap, this.index)) {
      var thisObj = cMap[this.index]
      console.log('Loading static settings')
      console.log(thisObj)
      if (Object.prototype.hasOwnProperty.call(thisObj, 'k_p')) this.ctr.kp = thisObj.k_p.value
      if (Object.prototype.hasOwnProperty.call(thisObj, 'k_i')) this.ctr.ki = thisObj.k_i.value
      if (Object.prototype.hasOwnProperty.call(thisObj, 'k_d')) this.ctr.kd = thisObj.k_d.value
    }
  }

  Read() {
    // placeholder for now
    // contents got moved to this.connect
  }

  parseVaisala(str, time) {
    try {
      var absHumidity = str.match(/a= *(\d+.\d+)/m)
      absHumidity = Number(absHumidity[1])
      var rh = str.match(/RH= *(\d+.\d+)/m)
      rh = Number(rh[1])
      var temperature = str.match(/T= *(-?\d+.\d+)/m)
      temperature = Number(temperature[1])
      var humidVolume = str.match(/H2O= *(\d+.\d+)/m)
      humidVolume = Number(humidVolume[1])
      var vaporPressureH2O = str.match(/pw= *(\d+.\d+)/m)
      vaporPressureH2O = Number(vaporPressureH2O[1])
      var dewPointT = str.match(/Tdf= *(-?\d+.\d+)/m)
      dewPointT = Number(dewPointT[1])
      var satPressureH2O = str.match(/pws= *(\d+.\d+)/m)
      satPressureH2O = Number(satPressureH2O[1])

      this.PV0.value = absHumidity // process variable
      this.PV2.value = rh // % relative humidity
      this.PV3.value = temperature // Temperature
      this.PV4.value = humidVolume // humid air volume
      this.PV5.value = vaporPressureH2O // water vapor pressure
      this.PV6.value = dewPointT // saturation temperature (dew point T)
      this.PV7.value = satPressureH2O // saturation pressure

      this.PV0.time = time
      this.PV2.time = time
      this.PV3.time = time
      this.PV4.time = time
      this.PV5.time = time
      this.PV6.time = time
      this.PV7.time = time
    } catch (error) {
      console.log('Vaisala Parsing Error')
      console.log(error)
    }
  }

  process(d) {
    d = d.toString()
    this.lastRead = Date.now()
    console.log('Vaisala Raw Data')
    console.log(d)
    if (d.length < 5) {
      return
    }

    this.parseVaisala(d, this.lastRead)

    this.CO0.value = this.ctr.update(this.PV0.value)
    this.CO0.time = Date.now()
    if (!Number.isNaN(this.CO0.value)) {
      this.hflow = this.CO0.value
      if (this.hflow > this.SP1.value) {
        this.hflow = this.SP1.value
      }

      if (this.hflow < 0) {
        this.hflow = 0
      }

      this.dflow = this.SP1.value - this.hflow
      // console.log('hflow:', this.hflow)
      // console.log('dflow:', this.dflow)
      if (this.AdditionalFields.Enable.value) {
        this.dryMFCsp(this.dflow)
        this.wetMFCsp(this.hflow)
      }
    }

    this.PV1.value = this.dryMFCmassFlow() + this.wetMFCmassFlow()
    this.PV1.time = Date.now()

    // console.log(d.toString())
    // console.log('PV: ' + this.PV0.value.toString())
    // console.log('MV: ' + this.CO0.value.toString())
    // console.log('dflow: ' + this.dflow.toString())
    // console.log('hflow: ' + this.hflow.toString())
  }

  dryMFCsp(val) {
    var call = 'api/MFCs/A/Set Point'
    if (!this.testFlag) {
      this.postVal(call, val)
    }
  }

  wetMFCsp(val) {
    var call = 'api/MFCs/B/Set Point'
    if (!this.testFlag) {
      this.postVal(call, val)
    }
  }

  findService(serviceName) {
    for (var service of this.services) {
      if (service.id === serviceName) return service
    }
  }

  dryMFCmassFlow() {
    var mfcService = this.findService('MFCs')
    return mfcService.obj.A['Mass Flow'].value.value
  }

  wetMFCmassFlow() {
    var mfcService = this.findService('MFCs')
    return mfcService.obj.B['Mass Flow'].value.value
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
          send: () => {},
          json: () => {},
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

  async connect() {
    try {
      await this.connection.connect(this.params)
      console.log('Connected to vaialah RH')
      await this.getVaisalaData()
      console.log('Began telnet session')
    } catch (error) {
      console.log('Error connecting to Vaisala RH')
      console.log(error)
      this.destroy()
    }
  }

  async getVaisalaData() {
    try {
      console.log('Getting data')
      await this.connection.exec('send', {ors: '\r', irs: '\n', shellPrompt: '>', execTimeout: 2000}).then(data => {
        try {
          this.process(data)
        } catch (error) {
          console.log('error processing vaisala data')
          console.log(error)
        }
        
      })
      console.log('Got data')
    } catch (error) {
      if (this.testFlag) {
        this.process(`RH=100.0 %RH T= 21.1 'C Tdf= 21.1 'C
          Td= 21.1 'C a= 18.5 g/m3   x=  15.8 g/kg  Tw= 21.1 'C H2O= 25352 ppmV
          pw=  25.05 hPa pws=  25.05 hPa h=  61.3 kJ/kg  dT= -0.0 'C`)
      } else {
        var report = Date(Date.now()).toString() + error.toString() + '\n'
        fsPromises.appendFile('../../humidifier_errors.log', report)
        try {
          await this.connection.end()
        } catch (error) {
          console.log('ending connection error', error)
        }
        this.connect() // attempt to re-connect
      }

      console.log('Error getting vaisala data')
      console.log(error)
    }
  }

  async destroy() {
    try {
      await this.connection.end()
      console.log('Ended')
      await this.connection.destroy()
      console.log('Destroyed')
    } catch (error) {
      // handle the throw (timeout)
      console.log(error)
    }
  }

  async keepAlive() {
    setInterval(() => {
      if (Date.now() - this.lastRead > this.checkInterval) {
        // try reconnecting
        // console.log('Reconnecting to vaisala rh')
        this.getVaisalaData()
      } else {
        // do nothing
      }
    }, this.checkInterval)

    // try forcefully closing the connection to eliminate the timeouts that happen
    // setInterval(() => {
    //  console.log('Restarting connection to vaiasala rh')
    //  this.destroy()
    // }, this.restartWait)
  }

  initialize() {
    console.log('Initializing humidity driver; testflag: ' + this.testFlag)
    if (!this.testFlag) {
      console.log('Humidity driver, connecting to Vaisala RH')
      this.connect()
    }

    console.log('Beginning keepAlive routine')
    this.keepAlive()
    // setInterval(() => {
    //     console.log('Enabled')
    //     console.log(this.AdditionalFields.Enable.value)
    // },500)
  }
}

// setTimeout(() => {
//     console.log('Starting')
// },4000)

module.exports = {
  Device: HumidityClass,
}

/* async function run() {
   let connection = new Telnet()

   // these parameters are just examples and most probably won't work for your use-case.
   let params = {
     host: '192.12.3.146',
     port: 23,
     negotiationMandatory: false,
     loginPrompt: 'HMT330 / 5.16',
     timeout: 1500
   }

   try {
     await connection.connect(params)
     console.log('Success')
     connection.on('data', (d) => {
       console.log('data event:')
       console.log(d.toString())
     })
     let res = await connection.exec('r',{ors:'\r',irs: '\n',shellPrompt: '>',execTimeout: 0})
     console.log('async result:', res)
     // await connection.end()
     // console.log('Ended')
     // await connection.destroy()
   // console.log('Destroyed')
     // setTimeout(() => {
     //   connection.exec('')
     // },2000)
   } catch(e) {
     // handle the throw (timeout)
     console.log(e)
   }

 }

 run()
*/
