#!/usr/bin/env node

const { Molecule } = require('molecule-javascript')
const schema = require('../htlc-template/schema/blockchain-combined.json')
const utils = require("@nervosnetwork/ckb-sdk-utils")
const process = require('process')
const fs = require('fs')
const shell = require('shelljs');

function blake2b(buffer) {
  return utils.blake2b(32, null, null, utils.PERSONAL).update(buffer).digest('binary')
}

// if (process.argv.length !== 4) {
//   console.log(`Usage: ${process.argv[1]} <duktape load0 binary> <js script>`)
//   process.exit(1)
// }

function str2hex(str) {
  var arr1 = ['0x'];
  for (var n = 0, l = str.length; n < l; n ++)
      {
    var hex = Number(str.charCodeAt(n)).toString(16);
    arr1.push(hex);
    }
  return arr1.join('');
}

const duktape_binary = fs.readFileSync('../ckb-duktape/build/load0')
const duktape_hash = blake2b(duktape_binary)
const js_script = fs.readFileSync('../htlc-template/build/cross_chain_type.js')

const verifier_list = [
        {
            "bls_pub_key": "0x04188ef9488c19458a963cc57b567adde7db8f8b6bec392d5cb7b67b0abc1ed6cd966edc451f6ac2ef38079460eb965e890d1f576e4039a20467820237cda753f07a8b8febae1ec052190973a1bcf00690ea8fc0168b3fbbccd1c4e402eda5ef22",
            "address": "0xf8389d774afdad8755ef8e629e5a154fddc6325a",
            "propose_weight": 1,
            "vote_weight": 1
        }
]
const cell_data = {
  latest_height: 0,
  nonce: 0,
  verifier_list,
}

const output_args = {
  id: "0xa98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a73da00000000",
  verifier_list,
}

const data = fs.readFileSync('gen_crosschain_cell.json', 'utf8')
      .replace("@DUKTAPE_HASH", utils.bytesToHex(duktape_hash))
      .replace("@SCRIPT_CODE", utils.bytesToHex(js_script))
      .replace("@DUKTAPE_CODE", utils.bytesToHex(duktape_binary))
      .replace("@CELL_DATA", str2hex(JSON.stringify(cell_data)))
      .replace("@OUTPUT_ARGS", str2hex(JSON.stringify(output_args)))



const mock_tx = 'gen_crosschain_cell_tx.json';
fs.writeFileSync(mock_tx, data)

const resolved_tx = JSON.parse(data)
const json_lock_script = resolved_tx.tx.outputs[0].type
const lock_script = {
  codeHash: json_lock_script.code_hash,
  hashType: json_lock_script.hash_type,
  args: json_lock_script.args
}
const lock_script_hash = blake2b(utils.hexToBytes(utils.serializeScript(lock_script)))

const cmd = `RUST_BACKTRACE=1 RUST_LOG=debug ../ckb-standalone-debugger/bins/target/release/ckb-debugger -g type -h ${utils.bytesToHex(lock_script_hash)} -t ${mock_tx}`;
console.log(cmd)

shell.exec(cmd);