// Copyright 2021 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const taskQueue = []
let taskQueueRunning = false

async function runTaskQueue() {
  if (taskQueueRunning || taskQueue.length === 0)
    return

  taskQueueRunning = true

  while (taskQueue.length !== 0) {
    const f = taskQueue.shift()
    await f()
  }

  taskQueueRunning = false
}

function criticalSection(f) {
  return new Promise((resolve, reject) => {
    taskQueue.push(() => {
      try {
        const ret = f()
        if (ret instanceof Promise) {
            ret.then(resolve).catch(reject)
        } else {
            resolve(ret)
        }
      } catch(e) {
        reject(e)
        return
      }
    })
    if (!taskQueueRunning)
      runTaskQueue()
  })
}

function promisify(thisArg, f, ...args) {
  return new Promise((resolve, reject) => {
    f.apply(thisArg, [...args, (...result) => {
      if (chrome.runtime.lastError)
        reject(new Error(chrome.runtime.lastError))
      else if (result.length === 0)
        resolve()
      else if (result.length === 1)
        resolve(result[0])
      else
        resolve(result)
    }])
  })
}

function deepPromisify(obj) {
  const result = {}
  for (const k in obj) {
    if (typeof obj[k] === "object")
      result[k] = deepPromisify(obj[k])
    else if (typeof obj[k] === "function")
      result[k] = (...args) => promisify(obj, obj[k], ...args)
    else
      result[k] = obj[k]
  }
  return result
}

// "cr" is the Promise-based version of the corresponding "chrome" API.
const cr = deepPromisify(chrome)
