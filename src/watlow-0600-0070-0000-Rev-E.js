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

var watlowController = {
  Operations: {
    'Analog Input Menu': {
      'Analog Input Value': {
        Description: 'View the process value.',
        Range: '-1,999.000 to 9,999.000 F or units -1,128.000 to 5,537.000 C',
        Modbus: [360, 360 + 90, 420, 420 + 100],
        Type: ['float', 'R'],
      },
      'Input Error': {
        Description: 'View the cause of the most recent error.',
        Range: {
          None: 61,
          Open: 65,
          Shorted: 127,
          'Measurement Error': 140,
          'Bad Calibration Data': 139,
          'Ambient Error': 9,
          'RTD Error': 141,
          Fail: 32,
        },
        Modbus: [362, 362 + 90, 422, 422 + 100],
        Type: ['uint', 'R'],
      },
      'Calibration Offset': {
        Description: 'Offset the input reading to compensate for lead wire resistance or other factors that cause the input reading to vary from the actual process value.',
        Range: '-1,999.000 to 9,999.000 F or units -1,110.555 to 5,555.000 C',
        Modbus: [382, 382 + 90, 442, 442 + 100],
        Type: ['float', 'W'],
      },
      'Clear Error': {
        Description: 'Clear latched input when input error condition no longer exists.',
        Range: {
          'Clear Error': 1221,
        },
        Modbus: [416, 416 + 90, 476, 476 + 100],
        Type: ['uint', 'W'],
      },
    },
    'Process Value Menu': {
      'Source Value A': {
        Description: 'View the value of Source A.',
        Range: '-1,999.000 to 9,999.000 F or units -1,128.000 to 5,537.000 C',
        Modbus: [3430, 3430 + 70, 4270, 4270 + 70],
        Type: ['float', 'R'],
      },
      'Source Value B': {
        Description: 'View the value of Source B.',
        Range: '-1,999.000 to 9,999.000 F or units -1,128.000 to 5,537.000 C',
        Modbus: [3432, 3432 + 70, 4272, 4272 + 70],
        Type: ['float', 'R'],
      },
      'Source Value C': {
        Description: 'View the value of Source C.',
        Range: '-1,999.000 to 9,999.000 F or units -1,128.000 to 5,537.000 C',
        Modbus: [3434, 3434 + 70, 4274, 4274 + 70],
        Type: ['float', 'R'],
      },
      'Source Value D': {
        Description: 'View the value of Source D.',
        Range: '-1,999.000 to 9,999.000 F or units -1,128.000 to 5,537.000 C',
        Modbus: [3436, 3436 + 70, 4276, 4276 + 70],
        Type: ['float', 'R'],
      },
      'Source Value E': {
        Description: 'View the value of Source E.',
        Range: {
          Off: 62,
          On: 63,
        },
        Modbus: [3438, 3438 + 70, 4278, 4278 + 70],
        Type: ['uint', 'R'],
      },
      Offset: {
        Description: 'Set an offset to be applied to this function\'s output.',
        Range: '-1,999.000 to 9,999.000 F or units -1,128.000 to 5,537.000 C',
        Modbus: [3444, 3444 + 70, 4284, 4284 + 70],
        Type: ['float', 'W'],
      },
      'Output Value': {
        Description: 'View the value of this function block\'s output.',
        Range: '-1,999.000 to 9,999.000 F or units -1,128.000 to 5,537.000 C',
        Modbus: [3442, 3442 + 70, 4282, 4282 + 70],
        Type: ['float', 'R'],
      },
      Error: {
        Description: 'View the value of this function block\'s output.',
        Range: {
          None: 61,
          Open: 65,
          Shorted: 127,
          'Measurement Error': 140,
          'Bad Calibration Data': 139,
          'Ambient Error': 9,
          'RTD Error': 14,
          Fail: 32,
          'Math error': 1423,
          'Not sourced': 246,
          Stale: 1617,
        },
        Modbus: [3452, 3452 + 70, 4292, 4292 + 70],
        Type: ['float', 'R'],
      },
    },
    'Control Loop Menu': {
      'Remote Set Point': {
        Description: 'Enable this loop to switch control to the remote set point.',
        Range: {
          No: 59,
          Yes: 106,
        },
        Modbus: [2540, 2540 + 80, 3380, 3380 + 80],
        Type: ['uint', 'W'],
      },
      'Control Mode': {
        Description: 'Select the method that this loop will use to control.',
        Range: {
          Off: 62,
          Auto: 10,
          Manual: 54,
        },
        Modbus: [2220, 2220 + 70, 3060, 3060 + 70],
        Type: ['uint', 'W'],
      },
      'Autotune Set Point': {
        Description: 'Set the set point that the autotune will use, as a percentage of the current set point.',
        Range: '50.0 to 200.0%',
        Modbus: [2258, 2258 + 70, 3098, 3098 + 70],
        Type: ['float', 'W'],
      },
      Autotune: {
        Description: 'Start an autotune.',
        Range: {
          No: 59,
          Yes: 106,
        },
        Modbus: [2260, 2260 + 70, 3100, 3100 + 70],
        Type: ['uint', 'W'],
      },
      'Set Point': {
        Description: 'Set the closed loop set point that the controller will automatically control to.',
        Range: 'Low Set Point to Maximum Set Point (Setup Page)',
        Modbus: [2500, 2500 + 80, 3340, 3340 + 80],
        Type: ['float', 'W'],
      },
    },
  },
  Setup: {
    'Analog Input Menu': {
      'Sensor Type': {
        Description: 'Set the analog sensor type to match the de- vice wired to this input.',
        Range: {
          Off: 62,
          Thermocouple: 95,
          Millivolts: 56,
          'Volts DC': 104,
          'Milliamps DC': 112,
          'RTD 100 Ohm': 113,
          'RTD 1K Ohm': 114,
          'Potentiometer 1K Ohm': 155,
          Thermistor: 229,
        },
        Modbus: [368, 368 + 90, 428, 428 + 100],
        Type: ['uint', 'W'],
      },
      'Thermocouple Linearization': {
        Description: 'Set the linear- ization to match the thermocou- ple wired to this input.',
        Range: {
          B: 11,
          C: 15,
          D: 23,
          E: 26,
          F: 30,
          J: 46,
          K: 48,
          N: 58,
          R: 80,
          S: 84,
          T: 93,
        },
        Modbus: [370, 370 + 90, 430, 430 + 100],
        Type: ['uint', 'W'],
      },
      'RTD Leads': {
        Description: 'Set to match the number of leads on the RTD wired to this input.',
        Range: {
          2: 1,
          3: 2,
        },
        Modbus: [372, 372 + 90, 432, 432 + 100],
        Type: ['uint', 'W'],
      },
    },
    'Process Value Menu': {
      Function: {
        Description: 'Set the function that will be applied to the source or sources.',
        Range: {
          Off: 62,
          'Sensor Backup': 1201,
          Average: 1367,
          Crossover: 1368,
          'Wet Bulb Dr Bulb': 1369,
          'Switch Over': 1370,
          Differential: 1373,
          Ratio: 1374,
          Add: 1375,
          Multiply: 1376,
          'Absolute Difference': 1377,
          Minimum: 1378,
          Maximum: 1379,
          'Square Root': 1380,
          'Vaisala RH Compensation': 1648,
          'PRessure to Altitude': 1649,
        },
        Modbus: [3440, 3440 + 70, 4280, 4280 + 70],
        Type: ['uint', 'W'],
      },
      'Source Function A': {
        Description: 'Set the type of function that will be used for this source.',
        Range: {
          None: 61,
          'Analog Input': 142,
          Linearization: 238,
          Math: 240,
          'Process Value': 241,
          variable: 245,
        },
        Modbus: [3400, 3400 + 70, 4240, 4240 + 70],
        Type: ['uint', 'W'],
      },
      'Source Instance A': {
        Description: 'Set the instance of the function selected above.',
        Range: '1 to 250',
        Modbus: [3410, 3410 + 70, 4250, 4250 + 70],
        Type: ['uint', 'W'],
      },
    },
  },
  Factory: {
    'Security Setting Menu': {
      'Operations Page': {
        Description: 'Use to change the required security level clearance required to gain access to the Operations Page.',
        Range: '1 to 3',
        Modbus: [43342, 45302],
        Type: ['uint', 'W'],
      },
      'Profiling Page': {
        Description: 'Use to change the required security level clearance required to gain access to the Operations Page.',
        Range: '1 to 3',
        Modbus: [43354, 45314],
        Type: ['uint', 'W'],
      },
      'Read Lock': {
        Description: 'Set the read security clearance level. The user can access the selected level and all lower levels. Applies regardless of Password Enable setting. Set the Read Lock clearance level. The user can have read access to the selected level and all lower levels. If the Write Security level is higher than the Read Lock, the Read Lock level takes priority.',
        Range: '1 to 5',
        Modbus: [43358, 45318],
        Type: ['uint', 'W'],
      },
    },
  },
}

module.exports = {
  obj: watlowController,
  manual: '0600-0070-0000',
  revision: 'E',
  date: '03/2016',
}
