const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const context = {globalThis:null};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync('shared/planner.js','utf8'),context);
const {parseCommand,splitPlan} = context.SaraPlanner;

test('parses browser, Windows, file, window, and Hindi commands', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(parseCommand('Gmail kholo'))),{type:'open-site',site:'gmail'});
  assert.deepEqual(JSON.parse(JSON.stringify(parseCommand('Switch to my GitHub tab'))),{type:'switch-tab-query',query:'github'});
  assert.deepEqual(JSON.parse(JSON.stringify(parseCommand('Open File Explorer'))),{type:'desktop',action:'open-explorer'});
  assert.deepEqual(JSON.parse(JSON.stringify(parseCommand('Open Photoshop'))),{type:'app-open',query:'photoshop'});
  assert.deepEqual(JSON.parse(JSON.stringify(parseCommand('Find file invoice.pdf'))),{type:'file-search',query:'invoice.pdf',scope:'all'});
  assert.deepEqual(JSON.parse(JSON.stringify(parseCommand('minimize window Notepad'))),{type:'window-state',state:'minimize',query:'notepad'});
  assert.deepEqual(JSON.parse(JSON.stringify(parseCommand('अगला टैब'))),{type:'move-tab',direction:1});
});

test('splits ordered workflows and never treats shell text as an executable command', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(splitPlan('open Gmail and then show desktop'))),['open Gmail','show desktop']);
  const command = parseCommand('open PowerShell and run calc');
  assert.equal(command.type,'app-open');
  assert.equal(command.query,'powershell and run calc');
});

test('rejects unknown commands', () => {
  assert.equal(parseCommand('do something mysterious'),null);
});
