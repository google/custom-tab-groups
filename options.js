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

const COLORS = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan',
]

let verbatimRules = ''
let verbatimGroupColors = ''
loadFromStorage()

saveButton.addEventListener('click', async () => {
  const groupColorsValue = groupColorsInput.value
  const rulesValue = rulesInput.value

  let rules, groupColors
  try {
    rules = deserializeRules(rulesValue)
    groupColors = deserializeGroupColors(groupColorsValue)
    console.log(rules, groupColors)
  } catch (e) {
    errorArea.innerText = e.message
    console.warn(e)
    return
  }

  const options = {
    rules,
    verbatimRules: rulesValue,

    groupColors,
    verbatimGroupColors: groupColorsValue,
  }

  try {
    await cr.storage.local.set(options)
  } catch (e) {
    errorArea.innerText = e.message
    console.warn(e)
    return
  }

  errorArea.innerText = ''
  verbatimRules = rulesValue
  verbatimGroupColors = groupColorsValue
})

window.addEventListener('beforeunload', (e) => {
  if (rulesInput.value === verbatimRules &&
      groupColorsInput.value === verbatimGroupColors) {
    return
  }
  e.preventDefault()
  e.returnValue = ''
})

async function loadFromStorage() {
  const options = {
    rules: [],
    verbatimRules: '',

    groupColors: [],
    verbatimGroupColors: '',

    ... await cr.storage.local.get(null)
  }

  verbatimRules = options.verbatimRules
  verbatimGroupColors = options.verbatimGroupColors

  rulesInput.value = verbatimRules
  groupColorsInput.value = verbatimGroupColors
}

function parsePair(line) {
  const re = /^\s*([^=]+?)\s*=\s*(.+?)\s*$/;
  if (!re.test(line))
    throw new Error(`Invalid line: '${line}'`)
  const [, lhs, rhs] = re.exec(line)
  return [lhs, rhs]
}

function deserializeGroupColors(value) {
  const groupColors = []
  for (let line of value.split('\n')) {
    line = line.trim()
    if (line.length === 0)
      continue
    const [name, color] = parsePair(line)
    if (!COLORS.includes(color))
      throw new Error(`Invalid color: '${color}'`)
    groupColors.push({ name, color })
  }
  return groupColors
}

function deserializeRules(value) {
  const rules = []
  for (let line of value.split('\n')) {
    line = line.trim()
    if (line.length === 0)
      continue
    const [regex, groupName] = parsePair(line)
    rules.push({ regex, groupName })
  }
  return rules
}
