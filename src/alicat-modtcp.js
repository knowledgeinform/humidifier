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

var EventEmitter = require('events')
const ad = require('./abstract-driver.js')
// create an empty modbus client
const ModbusRTU = require("modbus-serial")

var alicatGasList = [
    'Air',
    'Ar',
    'CH4',
    'CO',
    'CO2',
    'C2H6',
    'H2',
    'He',
    'N2',
    'N2O',
    'Ne',
    'O2',
    'C3H8',
    'n-C4H10',
    'C2H2',
    'C2H4',
    'i-C4H10',
    'Kr',
    'Xe',
    'SF6',
    'C-25',
    'C-10',
    'C-8',
    'C-2',
    'C-75',
    'HE-75',
    'HE-25',
    'A1025',
    'Star29',
    'P-5',
]

/**
All the error code meanings that Alicat documents for their controllers.
*/

// var errorCodes = {
//   ADC: 'Internal communication error (not common – requires repair at factory)',
//   EXH: 'Manual exhaust valve override (max drive on downstream valve)',
//   HLD: 'Valve drive hold is active (bypass active PID control)',
//   LCK: 'Membrane button lockout is active (see command codes below)',
//   MOV: 'Mass flow rate overage (outside measurable range including uncalibrated range)',
//   VOV: 'Volumetric flow rate overage (outside measurable range including uncalibrated range)',
//   POV: 'Pressure reading overage (outside measurable range including uncalibrated range)',
//   TOV: 'Temperature reading overage (outside measurable range)',
//   OVR: 'Totalizer has rolled over at least once or frozen at max value',
//   TMF: 'Totalizer missed some flow data (due to MOV or VOV error)',
//   OPL: 'Over pressure limit has been activated',
// }

class PromiseQueue {
    constructor({ maxQueueLength = 100,
        queueName = 'Shimadzu queue',
        interMessageWait = 0,
        debugTest = false,
        func, // function that must be executed synchronously
    }) {
        this.maxQueueLength = maxQueueLength
        this.queue = []
        this.queueName = queueName
        this.interMessageWait = interMessageWait
        this.debugTest = debugTest
        this.func = func
    }

    interMessageDelay() {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve()
            }, this.interMessageWait)
        })
    }

    send(command, timeout) {
        if (this.queue.length > this.maxQueueLength) {
            console.log('Too many router commands queued for ' + this.queueName)
            console.log('Queue size: ' + this.maxQueueLength)
            throw new Error('Too many router commands queued')
        } else {
            if (this.debugTest) {
                console.log('queue length')
                console.log(this.queue.length)
                console.log('Command')
                console.log(command)
            }
        }
        // console.log('queue length: ' + this.queue.length.toString())
        var lastPromise = this.queue[this.queue.length - 1]
        var cmdPromise = async lastPromise => {
            if (lastPromise) {
                try {
                    await lastPromise
                    if (this.interMessageWait > 0) {
                        await this.interMessageDelay()
                    }
                } catch (error) {
                    // last promise error'd out --> the next command probably doesn't care
                }
                var indexOfLP = this.queue.indexOf(lastPromise)
                if (indexOfLP >= 0) {
                    // console.log('removing last promise')
                    // remove the last Promise from the queue
                    this.queue.splice(indexOfLP, 1)
                } else {
                    throw new Error('Big problem in router queue where last promise could not be found')
                }
            } else {
                // console.log('last promise not defined')
            }

            var resp
            resp = await this.func(command, timeout)
            if (this.debugTest) console.log('serial resp')
            if (this.debugTest) console.log(resp)
            return resp
        }
        // console.log('pushing promise onto queue')
        this.queue.push(cmdPromise(lastPromise))

        return this.queue[this.queue.length - 1]
    }
}

class DeviceMFC extends EventEmitter {
    constructor({ id = 'A',
        testFlag,
        // setPoint,
        processVariable,
        debugTest,
        maxRefreshInterval = 1000,
        alicatType = 'MFC',
        address = '192.12.3.148',
    }) {
        super()
        this.oldGP = false
        this.id = id
        if (testFlag) address = '127.0.0.1'
        this.address = address
        this.alicatType = alicatType // default to mass-flow

        this.testFlag = testFlag
        if (testFlag === undefined) this.testFlag = false
        this.debugTest = debugTest
        if (debugTest === undefined) this.debugTest = false

        this.timeout = 200 // ms

        this.frameRepeat = new Map()

        this.property = new Map()
        this.property.set('unitID', new ad.DataPoint({ value: '' }))
        this.property.set('massFlow', new ad.DataPoint({ units: 'SLPM' }))
        this.property.set('volumeFlow', new ad.DataPoint({ units: 'LPM' }))
        this.property.set('gas', new ad.DataPoint({ value: '' }))
        this.property.set('pressure', new ad.DataPoint({ units: 'psia' }))
        this.property.set('temperature', new ad.DataPoint({ units: 'C' }))
        this.property.set('gasList', new Map())
        alicatGasList.forEach((e, i) => {
            this.property.get('gasList').set(i.toString(), e)
        })
        this.property.set('p', new ad.DataPoint({}))
        this.property.set('i', new ad.DataPoint({}))
        this.property.set('d', new ad.DataPoint({}))
        this.property.set('setPoint', new ad.DataPoint({ units: 'SLPM' }))
        this.property.set('status', new ad.DataPoint({ value: '' }))
        this.property.set('firmware', '')

        this.lockRefreshInterval = false
        this.maxRefreshInterval = maxRefreshInterval
        this.lastReadTime = {}
        this.lastReadTime.unitID = Date.now()
        this.lastReadTime.massFlow = Date.now()
        this.lastReadTime.volumeFlow = Date.now()
        this.lastReadTime.gas = Date.now()
        this.lastReadTime.pressure = Date.now()
        this.lastReadTime.temperature = Date.now()
        this.lastReadTime.gasList = Date.now()
        this.lastReadTime.p = Date.now()
        this.lastReadTime.i = Date.now()
        this.lastReadTime.d = Date.now()
        this.lastReadTime.setPoint = Date.now()
        this.lastReadTime.status = Date.now()
        this.lastReadTime.firmware = Date.now()

        // FS = full-scale
        this.FS = new Map()
        this.FS.set('massFlow', 0)
        this.FS.set('volumeFlow', 0)
        this.FS.set('pressure', 0)
        this.loopVar = 'massFlow'

        this.totalizer = false // assume no totalizer
        this.pressureController = false
        this.bidirectional = false // assume uni-directional

        this.processVariable = processVariable

        this.client = new ModbusRTU()
        this.client.connectTCP(this.address).catch(error => {
            console.log('Alicat-modtcp connect error')
            console.log(error)
        })
        this.client.setID(1)

        this.pq = new PromiseQueue({ queueName: 'alicat-modtcp', interMessageWait: 10, func: this.readDataPointQ.bind(this)})

        //   Modbus.tcp.connect(502, this.address, { debug: 'client' }, (err, connection) => {
        //     // console.log('cb function')
        //     // console.log(err)
        //     // console.log(connection)
        //     this.client = connection
        //     this.index = 1200
        //     // this.readReg(this.index)


        //   })
        //   this.client = new Modbus()
        //   // open connection to a tcp line
        //   this.client.connectTCP(this.address)
        //   this.client.setID(this.id)
    }

    readReg(i) {
        this.client.readInputRegisters(i, 2, (err, info) => {
            if (!err) {
                console.log('No error on: ', i)
                console.log(info)
            }
            // console.log('response')
            // console.log(err)
            // console.log(info)
        })
        if (this.index < 1250) {
            this.index = this.index + 1
            setTimeout(() => {
                this.readReg(this.index)
            }, 100)
        }
    }

    handleResponse(err, data) {

    }

    async readDataPointQ(reg, dp) {
        this.client.readInputRegisters(reg, 2, (err, data) => {
            if (err) {
                if (this.testFlag) {
                    dp.time = Date.now()
                    dp.value = -1
                } else {
                    console.log('get datapoint error for', reg)
                    console.log(err)
                }
            } else {
                console.log(data)
                dp.time = Date.now()
                dp.value = data.buffer.readFloatBE()
            }
        })
    }

    async readDataPoint(reg, dp) {
        this.pq.send(reg, dp)
    }

    get gas() {
        if (this.client) {
            this.client.readInputRegisters(1200 - 1, 1, (err, data) => {
                if (err) {
                    if (this.testFlag) {
                        this.property.get('gas').time = Date.now()
                        this.property.get('gas').value = 'Air'
                    } else {
                        console.log('get gas error')
                        console.log(err)
                    }
                } else {
                    this.property.get('gas').time = Date.now()
                    var gasNumber = data.buffer.readInt16BE()
                    // console.log('gasNumber:', gasNumber)
                    this.property.get('gas').value = alicatGasList[gasNumber]
                }
            })
        } else {
            console.log('this.client is NOT defined; hopefully, this is just temporary')
        }
        return this.property.get('gas')
    }

    set gas(val) {
        console.log('NOT YET IMPLEMENTED!!')
    }

    get massFlow() {
        // console.log('getting mass flow')
        if (this.client) {
            this.readDataPoint(1209 - 1, this.property.get('massFlow')).catch((err) => { console.log(err) })
        } else {
            console.log('this.client is NOT defined; hopefully, this is just temporary')
        }
        return this.property.get('massFlow')
    }

    get pressure() {
        if (this.client) {
            this.readDataPoint(1203 - 1, this.property.get('pressure')).catch((err) => { console.log(err) })
        } else {
            console.log('this.client is NOT defined; hopefully, this is just temporary')
        }
        return this.property.get('pressure')
    }

    get temperature() {
        if (this.client) {
            this.readDataPoint(1205 - 1, this.property.get('temperature')).catch((err) => { console.log(err) })
        } else {
            console.log('this.client is NOT defined; hopefully, this is just temporary')
        }
        return this.property.get('temperature')
    }

    get volumeFlow() {
        if (this.client) {
            this.readDataPoint(1207 - 1, this.property.get('volumeFlow')).catch((err) => { console.log(err) })
        } else {
            console.log('this.client is NOT defined; hopefully, this is just temporary')
        }
        return this.property.get('volumeFlow')
    }

    get setPoint() {
        if (this.client) {
            if (this.alicatType === 'MFC') {
                this.readDataPoint(1211 - 1, this.property.get('setPoint')).catch((err) => { console.log(err) })
            } else if (this.alicatType === 'PC') {
                this.readDataPoint(1205 - 1, this.property.get('setPoint')).catch((err) => { console.log(err) })
            }
        } else {
            console.log('this.client is NOT defined; hopefully, this is just temporary')
        }
        return this.property.get('setPoint')
    }

    set setPoint(val) {
        if (this.client) {
            val = Number(val)
            var b = Buffer.allocUnsafe(4)
            b.writeFloatBE(val)
            console.log('Writing', val, 'to setpoint as', b)
            this.client.writeRegisters(1010 - 1, b, (err, data) => {
                if (err) {
                    if (this.testFlag) {
                        this.property.get('setPoint').time = Date.now()
                        this.property.get('setPoint').value = val
                    } else {
                        console.log('set setPoint error')
                        console.log(err)
                    }
                } else {
                    console.log('No error writing setpoint')
                }
            })
        } else {
            console.log('this.client is NOT defined; hopefully, this is just temporary')
        }
    }

    initialize() {
        this.emit('initialized')
        return
    }

    commandString(shortDescription, args) {

    }
}

module.exports = {
    Device: DeviceMFC,
    commandString: DeviceMFC.commandString,
}

// var a = new DeviceMFC({ testFlag: false })

// setInterval(() => {
//     console.log(a.temperature)
//     // a.setPoint = 10
// }, 500)
