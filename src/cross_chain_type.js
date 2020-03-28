const { Molecule } = require("molecule-javascript");
const schema = require("../schema/blockchain-combined.json");

const names = schema.declarations.map((declaration) => declaration.name);
const scriptTypeIndex = names.indexOf("Script");
const scriptType = new Molecule(schema.declarations[scriptTypeIndex]);

function bytesToHex(b) {
  return (
    "0x" +
    Array.prototype.map
      .call(new Uint8Array(b), function (x) {
        return ("00" + x.toString(16)).slice(-2);
      })
      .join("")
  );
}

function bytesToString(b) {
  return Array.prototype.map
    .call(new Uint8Array(b), function (x) {
      return String.fromCharCode(x);
    })
    .join("");
}

function hexStringArrayToString(a) {
  let s = "";
  for (let i = 0; i < a.length; i++) {
    s = s + String.fromCharCode(parseInt(a[i]));
  }
  return s;
}

function hexStringArrayToHexString(a) {
  let s = "0x";
  for (let i = 0; i < a.length; i++) {
    s = s + a[i].substr(2);
  }
  return s;
}

function assert(condition, message) {
  message = message || "assert failed";
  if (!condition) {
    throw message;
  }
}

function get_cell_num(type) {
  var i = 0;
  while (true) {
    var ret = CKB.load_cell_data(0, i, type);
    if (typeof ret === "number") {
      return i;
    }
    i += 1;
  }
}

function objectEquals(x, y) {
    if (x === null || x === undefined || y === null || y === undefined) { return x === y; }
    // after this just checking type of one would be enough
    if (x.constructor !== y.constructor) { return false; }
    // if they are functions, they should exactly refer to same one (because of closures)
    if (x instanceof Function) { return x === y; }
    // if they are regexps, they should exactly refer to same one (it is hard to better equality check on current ES)
    if (x instanceof RegExp) { return x === y; }
    if (x === y || x.valueOf() === y.valueOf()) { return true; }
    if (Array.isArray(x) && x.length !== y.length) { return false; }

    // if they are dates, they must had equal valueOf
    if (x instanceof Date) { return false; }

    // if they are strictly equal, they both need to be object at least
    if (!(x instanceof Object)) { return false; }
    if (!(y instanceof Object)) { return false; }

    // recursive object equality check
    var p = Object.keys(x);
    return Object.keys(y).every(function (i) { return p.indexOf(i) !== -1; }) &&
        p.every(function (i) { return objectEquals(x[i], y[i]); });
}

function check_tx_type() {
  var group_output_num = get_cell_num(CKB.SOURCE.GROUP_OUTPUT);
  if (group_output_num !== 1) {
    throw "there must be exactly 1 output with crosschain script!";
  }
  var group_input_num = get_cell_num(CKB.SOURCE.GROUP_INPUT);
  if (group_input_num === 0) {
    return "init";
  } else if (group_input_num === 1) {
    return "transform";
  } else {
    throw "there must be 0 or 1 input with crosschain script!";
  }
}

function verify_init() {
  return 0
  // check output data
  const output_data = CKB.load_cell_data(0, 0, CKB.SOURCE.GROUP_OUTPUT);
  // CKB.debug(bytesToString(output_data));
  const output_data_obj = JSON.parse(bytesToString(output_data));
  assert(output_data_obj.latest_height === 0, "init latest_height should be 0");
  assert(output_data_obj.nonce === 0, "init nonce should be 0");

  const current_script = scriptType.deserialize(bytesToHex(CKB.load_script(0)));
  const args = hexStringArrayToString(current_script[2][1])
  // CKB.debug(args)
  const args_obj = JSON.parse(args);

  const input = CKB.load_input(0, 0, CKB.SOURCE.INPUT)
  if (typeof input === "number") {
    throw new Error(`Invalid response when loading input`);
  }
  const tx_hash_index = bytesToHex(input.slice(8))
  // check id
  assert(args_obj.id === tx_hash_index, "lockscript args.id should be the tx_hash+index of the first input");

  // check verifier_list
  // CKB.debug(JSON.stringify({args_obj: args_obj.verifier_list, output_data_obj: output_data_obj.verifier_list}, null, 2))
  assert(objectEquals(args_obj.verifier_list, output_data_obj.verifier_list), 'verifier_list in data should match that in lock args')
}

// FIXIT: will be wrong if the num precision over max value in js
function LittleEndianArrayToNum(arr) {
  arr = new Uint8Array(arr);
  let num = 0;
  for (var i = 0; i <arr.length; i++) {
    num += arr[i] * 2 ** ( 8 * i )
  }
  return num;
}

// FIXIT: will be wrong if the num precision over max value in js
function HexToNum(hex) {
  return parseInt(Number(hex), 10);
}

function verify_transform() {
  // check capacity_output >= capacity_input
  const input_capacity = CKB.load_cell_by_field(0, 0, CKB.SOURCE.GROUP_INPUT, CKB.CELL.CAPACITY);
  const output_capacity = CKB.load_cell_by_field(0, 0, CKB.SOURCE.GROUP_OUTPUT, CKB.CELL.CAPACITY);
  CKB.debug(JSON.stringify({
    in: bytesToHex(input_capacity),
    out: bytesToHex(output_capacity),
    in_num: LittleEndianArrayToNum(input_capacity),
    out_num: LittleEndianArrayToNum(output_capacity),
  }));

  assert(LittleEndianArrayToNum(input_capacity) <= LittleEndianArrayToNum(output_capacity), 'crosschain cell output capacity should be equal to or more than input capacity');

  // verify witness
  const witness = CKB.load_witness(0, 0, CKB.SOURCE.INPUT);
  const witness_obj = JSON.parse(bytesToString(witness));
  const input_data = CKB.load_cell_data(0, 0, CKB.SOURCE.GROUP_INPUT);
  const input_data_obj = JSON.parse(bytesToString(input_data));
  const output_data = CKB.load_cell_data(0, 0, CKB.SOURCE.GROUP_OUTPUT);
  const output_data_obj = JSON.parse(bytesToString(output_data));
  // CKB.debug(JSON.stringify({
  //   witness_obj, input_data_obj, output_data_obj,
  // }, null, 2))

  const balance = {};
  const blocks = witness_obj.messages;
  for (let i = 0; i <blocks.length; i++) {
    // check header
    const header = blocks[i].header;
    const height = HexToNum(header.height)
    assert(height > input_data_obj.latest_height, 'contain timeout block in witness');
    input_data_obj.latest_height = height;
    // TODO: verify proof
    input_data_obj.verifier_list = header.validators;

    // check events
    const events = blocks[i].events;
    for (let j = 0; j < events.length; j++) {
      const event = events[j];
      assert(event.kind === 'cross_to_ckb', 'event error');
      assert(event.topic === 'burn_asset', 'event error');
      // check nonce
      assert(event.nonce === input_data_obj.nonce + 1, 'nonce not match');
      input_data_obj.nonce = event.nonce;
      // calc output
      let asset = balance[event.asset_id] || {}
      asset[event.receiver] = asset[event.receiver] || 0 + event.amount;
      balance[event.asset_id] = asset
    }
  }

    const fee_receiver = witness_obj.fee_receiver;
    for (let asset_id in balance) {
      let fee_total = 0;
      let asset = balance[asset_id];
      for (let receiver in asset) {
        let fee = Math.floor(asset[receiver] * input_data_obj.fee_rate / 100000000);
        fee_total += fee;
        asset[receiver] -= fee;
      }
      asset[fee_receiver] = fee_total
    }

    // CKB.debug(JSON.stringify({
    //   balance
    // }, null, 2))

    // TODO: check output cell data match changed input_data
    // TODO: check output match balance

    // iter input, ensure all the same lockscript
    // let i = 1;
    // let lockhash = null;
    // while(1) {
    //   CKB.debug('before load');
    //   let temp_lockhash = CKB.load_cell_data(0, i, CKB.SOURCE.INPUT);
    //   CKB.debug(`after load, ${temp_lockhash}`);
    //   if (lockhash === CKB.CODE.INDEX_OUT_OF_BOUND) {
    //     break;
    //   }
    //   let temp_lockhash = CKB.load_cell_by_field(0, i, CKB.SOURCE.INPUT, CKB.CELL.LOCK_HASH);
    //   temp_lockhash = bytesToHex(temp_lockhash);
    //   CKB.debug(temp_lockhash);
    //   if (lockhash !== null) {
    //     assert(temp_lockhash === lockhash, 'inputs lock should be all the same except first');
    //   } else {
    //     lockhash = temp_lockhash;
    //   }
    //   i += 1;
    // }

    // if (lockhash !== null) {
    //   assert(balance.length === 0, 'witness event not match input')
    // }

    // i = 1;
    // while(1) {
    //   let temp_lockhash = CKB.load_cell_by_field(0, i, CKB.SOURCE.INPUT, CKB.CELL.LOCK_HASH);
    //   if (typeof lockhash === "number") {
    //     break;
    //   }
    //   if (lockhash !== null) {
    //     assert(lockhash temp_lockhash === lockhash, 'inputs lock should be all the same except first');
    //   } else {
    //     lockhash = temp_lockhash;
    //   }
    //   i += 1;
    // }


}

function main() {
  // CKB.debug("start crosschain script");
  var tx_type = check_tx_type();
  CKB.debug("tx_type:", tx_type);
  CKB.debug(JSON.stringify(CKB));
  if (tx_type == "init") {
    verify_init();
  } else {
    verify_transform();
  }
}

main();
