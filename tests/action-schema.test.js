const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const context = {globalThis:null};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync('shared/action-schema.js','utf8'),context);
const valid = context.SaraActionSchema.valid;

test('accepts known browser, desktop, file, and confirmation actions', () => {
  assert.equal(valid({version:'1',type:'open-site',site:'gmail'}),true);
  assert.equal(valid({version:'1',type:'desktop',action:'open-explorer'}),true);
  assert.equal(valid({version:'1',type:'file-search',query:'invoice',scope:'downloads'}),true);
  assert.equal(valid({version:'1',type:'ui-activate',name:'Save',role:'ButtonControl',confirmed:false}),true);
});

test('rejects arbitrary commands, paths, fields, and insecure URLs', () => {
  assert.equal(valid({version:'1',type:'desktop',action:'run-shell'}),false);
  assert.equal(valid({version:'1',type:'app-open',query:'Notepad',path:'C:/evil.exe'}),false);
  assert.equal(valid({version:'1',type:'open-url',url:'http://example.com'}),false);
  assert.equal(valid({version:'2',type:'app-open',query:'Notepad'}),false);
});
