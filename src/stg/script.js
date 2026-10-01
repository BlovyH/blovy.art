// 弹幕脚本：一串波次。at = 本局开始后的毫秒数（什么时候发射），pattern = patterns.js 里的能力名，
// 其余字段是该 pattern 自己的参数（各 pattern 认哪些字段，见它的实现）。
// 玩法数据跟代码一起版本化，不进 content.json —— 那份有本地与 R2 双份漂移的问题。
export const SCRIPT = [
  {
    "at": 0,
    "pattern": "ring",
    "from": "grid",
    "count": 24,
    "lanes": 60,
    "size": 1,
    "rise": [
      1,
      1.7
    ],
    "spread": 60,
    "speed": 0.68,
    "origin": {
      "x": 0.5,
      "y": 0.15
    },
    "angle": 90,
    "spacing": 40,
    "center": {
      "x": 0.24999999999999978,
      "y": 0.4
    },
    "radius": 0.08,
    "gap": 0.18
  },
  {
    "at": 200,
    "pattern": "ring",
    "from": "grid",
    "count": 24,
    "lanes": 60,
    "size": 1,
    "rise": [
      1,
      1.7
    ],
    "spread": 60,
    "speed": 0.68,
    "origin": {
      "x": 0.5,
      "y": 0.15
    },
    "angle": 90,
    "spacing": 40,
    "center": {
      "x": 0.24999999999999978,
      "y": 0.4
    },
    "radius": 0.08,
    "gap": 0.18
  },
  {
    "at": 0,
    "pattern": "ring",
    "from": "grid",
    "count": 24,
    "lanes": 60,
    "size": 1,
    "rise": [
      1,
      1.7
    ],
    "spread": 60,
    "speed": 0.68,
    "origin": {
      "x": 0.5,
      "y": 0.15
    },
    "angle": 90,
    "spacing": 40,
    "center": {
      "x": 0.7514748362313329,
      "y": 0.3992436616751469
    },
    "radius": 0.08,
    "gap": 0.18
  },
  {
    "at": 200,
    "pattern": "ring",
    "from": "grid",
    "count": 24,
    "lanes": 60,
    "size": 1,
    "rise": [
      1,
      1.7
    ],
    "spread": 60,
    "speed": 0.68,
    "origin": {
      "x": 0.5,
      "y": 0.15
    },
    "angle": 90,
    "spacing": 40,
    "center": {
      "x": 0.7514748362313329,
      "y": 0.3992436616751469
    },
    "radius": 0.08,
    "gap": 0.18
  },
  {
    "at": 1200,
    "pattern": "fan",
    "from": "grid",
    "count": 22,
    "lanes": 60,
    "size": 0.5,
    "rise": [
      1,
      1.7
    ],
    "spread": 99,
    "speed": 0.29,
    "origin": {
      "x": 0.049085455700359513,
      "y": 0.09800599955069891
    },
    "angle": 34,
    "spacing": 40,
    "center": {
      "x": 0.5,
      "y": 0.16999999999999982
    },
    "radius": 0.08,
    "gap": 0.18
  },
  {
    "at": 1200,
    "pattern": "fan",
    "from": "grid",
    "count": 22,
    "lanes": 60,
    "size": 0.5,
    "rise": [
      1,
      1.7
    ],
    "spread": 99,
    "speed": 0.29,
    "origin": {
      "x": 0.9509145442996405,
      "y": 0.09800599955069891
    },
    "angle": 146,
    "spacing": 40,
    "center": {
      "x": 0.5,
      "y": 0.16999999999999982
    },
    "radius": 0.08,
    "gap": 0.18
  },
  {
    "at": 1500,
    "pattern": "fan",
    "from": "grid",
    "count": 22,
    "lanes": 60,
    "size": 0.5,
    "rise": [
      1,
      1.7
    ],
    "spread": 99,
    "speed": 0.39,
    "origin": {
      "x": 0.049085455700359513,
      "y": 0.09800599955069891
    },
    "angle": 41,
    "spacing": 40,
    "center": {
      "x": 0.5,
      "y": 0.16999999999999982
    },
    "radius": 0.08,
    "gap": 0.18
  },
  {
    "at": 1500,
    "pattern": "fan",
    "from": "grid",
    "count": 22,
    "lanes": 60,
    "size": 0.5,
    "rise": [
      1,
      1.7
    ],
    "spread": 99,
    "speed": 0.39,
    "origin": {
      "x": 0.9509145442996405,
      "y": 0.09800599955069891
    },
    "angle": 139,
    "spacing": 40,
    "center": {
      "x": 0.5,
      "y": 0.16999999999999982
    },
    "radius": 0.08,
    "gap": 0.18
  },
  {
    "at": 2100,
    "pattern": "fan",
    "from": "grid",
    "count": 22,
    "lanes": 60,
    "size": 0.5,
    "rise": [
      1,
      1.7
    ],
    "spread": 99,
    "speed": 0.4,
    "origin": {
      "x": 0.049085455700359513,
      "y": 0.09800599955069891
    },
    "angle": 41,
    "spacing": 40,
    "center": {
      "x": 0.5,
      "y": 0.16999999999999982
    },
    "radius": 0.08,
    "gap": 0.18
  },
  {
    "at": 2600,
    "pattern": "burst",
    "count": 66,
    "size": 0.8500000000000001,
    "speed": 1,
    "origin": {
      "x": 0,
      "y": 1
    },
    "spread": 0.6000000000000001,
    "from": "point",
    "lanes": 39,
    "rise": [
      1,
      1.8
    ]
  },
  {
    "at": 2600,
    "pattern": "burst",
    "count": 66,
    "size": 0.8500000000000001,
    "speed": 1,
    "origin": {
      "x": 1,
      "y": 1
    },
    "spread": 0.6000000000000001,
    "from": "point",
    "lanes": 39,
    "rise": [
      0.65,
      1.6
    ]
  },
  {
    "at": 7200,
    "pattern": "burst",
    "from": "top",
    "count": 123,
    "lanes": 60,
    "size": 0.5,
    "rise": [
      0.8500000000000001,
      2.75
    ],
    "spread": 0.9,
    "origin": {
      "x": 0.254269588264801,
      "y": 0.5977933015988075
    },
    "speed": 0.75,
    "angle": 0,
    "spacing": 40,
    "drop": [
      0.30000000000000004,
      1.2
    ]
  },
  {
    "at": 6600,
    "pattern": "fall",
    "from": "grid",
    "count": 60,
    "lanes": 60,
    "size": 0.30000000000000004,
    "rise": [
      1,
      1.7
    ],
    "spread": 0.5,
    "speed": 0.42,
    "drop": [
      0,
      1.2
    ],
    "origin": {
      "x": 0.254269588264801,
      "y": 0.5977933015988075
    },
    "mode": "ballistic",
    "duration": 3000,
    "tilt": 0,
    "sway": 0.15
  }
]
