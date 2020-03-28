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

// function num2hex(num) {
//   // 0x00e40b54020000000000000000000000
//   num = num.slice(2);
//   for (let i = 0; i <num.length; i+=2) {

//   }
// }

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
const udt_binary = fs.readFileSync('../ckb-miscellaneous-scripts/build/simple_udt')
const udt_hash = blake2b(udt_binary)

const verifier_list = [
        {
            "bls_pub_key": "0x04188ef9488c19458a963cc57b567adde7db8f8b6bec392d5cb7b67b0abc1ed6cd966edc451f6ac2ef38079460eb965e890d1f576e4039a20467820237cda753f07a8b8febae1ec052190973a1bcf00690ea8fc0168b3fbbccd1c4e402eda5ef22",
            "address": "0xf8389d774afdad8755ef8e629e5a154fddc6325a",
            "propose_weight": 1,
            "vote_weight": 1
        }
]
const fee_rate = 100000
const crosschain_input_data = {
  fee_rate,
  latest_height: 0,
  nonce: 0,
  verifier_list,
}

const crosschain_output_data = {
  fee_rate,
  latest_height: 0,
  nonce: 0,
  verifier_list,
}

const output_args = {
  id: "0xa98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a73da00000000",
  verifier_list,
}

const data = fs.readFileSync('transform_crosschain_cell.json', 'utf8')
      .replace(/@DUKTAPE_CODE/gi, utils.bytesToHex(duktape_binary))
      .replace(/@DUKTAPE_HASH/gi, utils.bytesToHex(duktape_hash))
      .replace(/@UDT_CODE/gi, utils.bytesToHex(udt_binary))
      .replace(/@UDT_HASH/gi, utils.bytesToHex(udt_hash))
      .replace(/@SCRIPT_CODE/gi, utils.bytesToHex(js_script))
      .replace(/@CROSSCHAIN_INPUT_DATA/gi, str2hex(JSON.stringify(crosschain_input_data)))
      .replace(/@CROSSCHAIN_OUTPUT_DATA/gi, str2hex(JSON.stringify(crosschain_output_data)))
      .replace(/@CROSSCHAIN_TYPE_ARGS/gi, str2hex(JSON.stringify(output_args)))



const mock_tx = 'transform_crosschain_cell_tx.json';
const resolved_tx = JSON.parse(data)

// console.log(resolved_tx);
// console.dir(resolved_tx, { depth: 3 });

function randomHex(length) {
  var result = "0x";
  var characters = "abcdef0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const secp256_lockscript_hash = '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8';
const crosschain_lockscript = {
  args: '0x',
  code_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  hash_type: 'data'
}

function push_udt_input(tx, args) {
  const tx_hash = randomHex(64);
  const input = {
        input: {
          "previous_output": {
            tx_hash,
            "index": "0x0"
          },
          "since": "0x0"
        },
        "output": {
          "capacity": "0x4b9f96b00",
          "lock": crosschain_lockscript,
          "type": {
            "args": args.owner,
            "code_hash": utils.bytesToHex(udt_hash),
            "hash_type": "data"
          },
        },
        "data": args.amount
      }
  tx.mock_info.inputs.push(input);
  tx.tx.inputs.push(input.input);
}

function addr_lock(addr) {
  return {
    args: addr,
    code_hash: secp256_lockscript_hash,
    hash_type: 'type'
  }
}

function push_udt_output(tx, args) {
  const output = {
        "capacity": "0x0",
        "type": {
          args: args.owner,
          code_hash: utils.bytesToHex(udt_hash),
          hash_type: 'data'
        },
        "lock": args.lock,
      }
  tx.tx.outputs.push(output);
  tx.tx.outputs_data.push(args.amount);
}

const owner1 = '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07941'
const owner2 = '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07942'
const owner3 = '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07943'
const owner4 = '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07944'
const to1 = '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07921'
const to2 = '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07922'
const fee_receiver = '0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07923'

function calcOwnerHash(owner) {
  const udt = {
    codeHash: utils.bytesToHex(udt_hash),
    hashType: "data",
    args: owner
  }
const hash = blake2b(utils.hexToBytes(utils.serializeScript(udt)))
return utils.bytesToHex(hash);
}

const udt1_hash = calcOwnerHash(owner1)
const udt2_hash = calcOwnerHash(owner2)

push_udt_input(resolved_tx, {owner: owner1, amount: utils.toHexInLittleEndian('0x'+Number(7000).toString(16), 16)});
push_udt_output(resolved_tx, {owner: owner1, amount: utils.toHexInLittleEndian('0x'+Number(2997).toString(16), 16), lock: addr_lock(to1)})
push_udt_output(resolved_tx, {owner: owner1, amount: utils.toHexInLittleEndian('0x'+Number(3).toString(16), 16), lock: addr_lock(fee_receiver)})
push_udt_output(resolved_tx, {owner: owner1, amount: utils.toHexInLittleEndian('0x'+Number(4000).toString(16), 16), lock: crosschain_lockscript})

push_udt_input(resolved_tx, {owner: owner2, amount: utils.toHexInLittleEndian('0x'+Number(8000).toString(16), 16)});
push_udt_output(resolved_tx, {owner: owner2, amount: utils.toHexInLittleEndian('0x'+Number(1998).toString(16), 16), lock: addr_lock(to2)})
push_udt_output(resolved_tx, {owner: owner2, amount: utils.toHexInLittleEndian('0x'+Number(2).toString(16), 16), lock: addr_lock(fee_receiver)})
push_udt_output(resolved_tx, {owner: owner2, amount: utils.toHexInLittleEndian('0x'+Number(6000).toString(16), 16), lock: crosschain_lockscript})

const witness = {
  fee_receiver,
    "messages": [
        {
            "header": {
                "height": "0x0000000000000011",
                "validatorVersion": "0x0000000000000000",
                "validators": []
            },
            "events": [
              {
                asset_id: udt1_hash,
                receiver: to1,
                amount: 3000,
                nonce: 1,
                kind: "cross_to_ckb",
                topic: "burn_asset",
              },
              {
                asset_id: udt2_hash,
                receiver: to2,
                amount: 2000,
                nonce: 2,
                kind: "cross_to_ckb",
                topic: "burn_asset",
              },
            ],
            "proof": ""
        }
    ]
}
resolved_tx.tx.witnesses.push(str2hex(JSON.stringify(witness)));

fs.writeFileSync(mock_tx, JSON.stringify(resolved_tx, null, 2))

const runned_cache = {};

function runscript(i) {
  const json_lock_script = resolved_tx.tx.outputs[i].type
  const lock_script = {
    codeHash: json_lock_script.code_hash,
    hashType: json_lock_script.hash_type,
    args: json_lock_script.args
  }
  // console.log({lock_script});
  const lock_script_hash = blake2b(utils.hexToBytes(utils.serializeScript(lock_script)))
  if (runned_cache[lock_script_hash]) {
    return;
  }
  const cmd = `RUST_BACKTRACE=1 RUST_LOG=debug ../ckb-standalone-debugger/bins/target/release/ckb-debugger -g type -h ${utils.bytesToHex(lock_script_hash)} -t ${mock_tx}`;
  console.log(cmd)

  shell.exec(cmd);
  runned_cache[lock_script_hash] = 1;
}

function main() {
  for (let i = resolved_tx.tx.outputs.length-1; i >= 0; i--) {
    runscript(i);
  }
}

main();