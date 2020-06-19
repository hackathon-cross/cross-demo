#!/usr/bin/env node

const CKB = require("@nervosnetwork/ckb-sdk-core").default;
const utils = require("@nervosnetwork/ckb-sdk-utils");
const ECPair = require("@nervosnetwork/ckb-sdk-utils/lib/ecpair");


const process = require("process");
const fs = require("fs");
const _ = require("lodash");
const {SerializeCrosschainWitness, SerializeMessageVec} = require("./witness_schema_new")
const CellCapacity = 20000000000000n;

// const duktapeBinary = fs.readFileSync("./deps/load0");
// const duktapeHash = blake2b(duktapeBinary);
const simpleUdtBinary = fs.readFileSync("./deps/simple_udt");
const simpleUdtHash = blake2b(simpleUdtBinary);

// const crosschainTypescript = fs.readFileSync("./build/cross_chain_type.js");
const crosschainTypescript = fs.readFileSync("./deps/always_success");
// const crosschainTypescript = fs.readFileSync("~/CLionProjects/crosschain-scripts/build/test_type");
// const testTypeBinary = fs.readFileSync("~/CLionProjects/crosschain-scripts/build/test_type");
// const testTypeBinaryHash = blake2b( testTypeBinary )

const crosschainTypescriptHash = blake2b(crosschainTypescript);
const crosschainLockscript = fs.readFileSync("./deps/crosschain_lockscript");
const crosschainLockscriptHash = blake2b(crosschainLockscript);

const privateKey =
  "0xd00c06bfd800d27397002dca6fb0993d5ba6399b4238b2f29ee9deb97593d2bc";
const bPrivKey =
  "0xd00c06bfd800d27397002dca6fb0993d5ba6399b4238b2f29ee9deb97593d2b0";
const nodeUrl = "http://127.0.0.1:8114/";
const configPath = "./deploy/config.json";
const relayerConfigPath = "../relayer/config.json";
const config = JSON.parse(fs.readFileSync(configPath));
const fee = 100000000n;

const ckb = new CKB(nodeUrl);

process.on("exit", code => {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`About to exit with code: ${code}, save config success`);
});

function blake2b(buffer) {
  return utils
    .blake2b(32, null, null, utils.PERSONAL)
    .update(buffer)
    .digest("binary");
}

function str2hex(str) {
  var arr1 = ["0x"];
  for (var n = 0, l = str.length; n < l; n++) {
    var hex = Number(str.charCodeAt(n)).toString(16);
    arr1.push(hex);
  }
  return arr1.join("");
}

function LittleEndianHexToNum(hex) {
  if (hex.startsWith("0x")) {
    hex = hex.slice(2);
  }
  let num = BigInt(0);
  for (let c = 0; c < hex.length; c += 2) {
    num += BigInt(parseInt(hex.substr(c, 2), 16) * 2 ** (4 * c));
  }
  return num;
}

async function deploy(code_list) {
  const secp256k1Dep = await ckb.loadSecp256k1Dep();
  const publicKey = ckb.utils.privateKeyToPublicKey(privateKey);
  const publicKeyHash = `0x${ckb.utils.blake160(publicKey, "hex")}`;
  const lockScript = {
    hashType: secp256k1Dep.hashType,
    codeHash: secp256k1Dep.codeHash,
    args: publicKeyHash
  };
  const lockHash = ckb.utils.scriptToHash(lockScript);

  const unspentCells = await ckb.loadCells({
    lockHash
  });
  const totalCapacity = unspentCells.reduce(
    (sum, cell) => sum + BigInt(cell.capacity),
    BigInt(0)
  );

  // For simplicity, we will just use 1 CKB as fee. On a real setup you
  // might not want to do this.
  const capacity_list = code_list.map(
    code => BigInt(code.length) * 100000000n + 4100000000n
  );
  //   console.log(capacity_list);
  const outputs = capacity_list.map(capacity => {
    return {
      lock: {
        codeHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        hashType: "data",
        args: "0x"
      },
      type: null,
      capacity: "0x" + capacity.toString(16)
    };
  });

  outputs.push({
    lock: lockScript,
    type: null,
    capacity: "0x" + (totalCapacity - _.sum(capacity_list) - fee).toString(16)
  });
  const outputsData = code_list.map(code => utils.bytesToHex(code));
  outputsData.push("0x");

  const transaction = {
    version: "0x0",
    cellDeps: [
      {
        outPoint: secp256k1Dep.outPoint,
        depType: "depGroup"
      }
    ],
    headerDeps: [],
    inputs: unspentCells.map(cell => ({
      previousOutput: cell.outPoint,
      since: "0x0"
    })),
    outputs,
    witnesses: [
      {
        lock: "",
        inputType: "",
        outputType: ""
      }
    ],
    outputsData
  };
  const signedTransaction = ckb.signTransaction(privateKey)(transaction);

  const txHash = await ckb.rpc.sendTransaction(
    signedTransaction,
    "passthrough"
  );
  config.deployTxHash = txHash;
  console.log(`deployTxHash: ${txHash}`);
}

async function storeConfigToRelayer(config) {
 const relayerConfig = JSON.parse(fs.readFileSync(relayerConfigPath));

 relayerConfig.deployTxHash = config.deployTxHash;

 relayerConfig.ckb.output = {
   lock: config.crosschainLockscript,
   type: config.crosschainTypescript,
 }

  fs.writeFileSync(relayerConfigPath, JSON.stringify(relayerConfig, null, 2));
}

async function createCrosschainCell() {
  const secp256k1Dep = await ckb.loadSecp256k1Dep();

  const publicKey = ckb.utils.privateKeyToPublicKey(privateKey);
  const publicKeyHash = `0x${ckb.utils.blake160(publicKey, "hex")}`;

  const lockScript = {
    hashType: secp256k1Dep.hashType,
    codeHash: secp256k1Dep.codeHash,
    args: publicKeyHash
  };
  const lockHash = ckb.utils.scriptToHash(lockScript);

  const unspentCells = await ckb.loadCells({
    lockHash
  });
  const totalCapacity = unspentCells.reduce(
    (sum, cell) => sum + BigInt(cell.capacity),
    BigInt(0)
  );

  const CellCapacity = 20000000000000n;

  const verifier_list = [
    {
      bls_pub_key:
        "0x04188ef9488c19458a963cc57b567adde7db8f8b6bec392d5cb7b67b0abc1ed6cd966edc451f6ac2ef38079460eb965e890d1f576e4039a20467820237cda753f07a8b8febae1ec052190973a1bcf00690ea8fc0168b3fbbccd1c4e402eda5ef22",
      address: "0xf8389d774afdad8755ef8e629e5a154fddc6325a",
      propose_weight: 1,
      vote_weight: 1
    }
  ];
  //   console.log(unspentCells[0]);
  const argsObj = unspentCells[0].outPoint;
  const args = str2hex(JSON.stringify(argsObj));

  // TODO: change to molecule
  const cellDataObj = {
    verifier_list: [],
    nonce: 0,
    latest_height: 0
  };
  const cellData = str2hex(JSON.stringify(cellDataObj));
  config.crosschainTypescript = {
    codeHash: utils.bytesToHex(crosschainTypescriptHash),
    hashType: "data",
    args
  };
  config.crosschainLockscript = {
    codeHash: utils.bytesToHex(crosschainLockscriptHash),
    hashType: "data",
    args: utils.scriptToHash(config.crosschainTypescript)
  };

  await storeConfigToRelayer(config)
  const transaction = {
    version: "0x0",
    cellDeps: [
      {
        outPoint: {
          txHash: config.deployTxHash,
          index: "0x1"
        },
        depType: "code"
      },
      {
        outPoint: {
          txHash: config.deployTxHash,
          index: "0x2"
        },
        depType: "code"
      },
      {
        outPoint: secp256k1Dep.outPoint,
        depType: "depGroup"
      }
    ],
    headerDeps: [],
    inputs: unspentCells.map(cell => ({
      previousOutput: cell.outPoint,
      since: "0x0"
    })),
    outputs: [
      {
        lock: lockScript,
        type: null,
        capacity: "0x" + (totalCapacity - fee - CellCapacity).toString(16)
      },
      {
        type: config.crosschainTypescript,
        lock: config.crosschainLockscript,
        capacity: "0x" + CellCapacity.toString(16)
      }
    ],
    witnesses: [
      {
        lock: "",
        inputType: "",
        outputType: ""
      }
    ],
    outputsData: ["0x", cellData]
  };
  //   console.log(JSON.stringify(transaction, null, 2))
  const signedTransaction = ckb.signTransaction(privateKey)(transaction);
  //   console.log(JSON.stringify(signedTransaction, null, 2))

  const txHash = await ckb.rpc.sendTransaction(
    signedTransaction,
    "passthrough"
  );
  console.log(`createCrosschainCell hash: ${txHash}`);
  config.createCrosschainCellTxHash = txHash;
}

async function issueSUDT() {
  const secp256k1Dep = await ckb.loadSecp256k1Dep();

  // admin
  const publicKey = ckb.utils.privateKeyToPublicKey(privateKey);
  const publicKeyHash = `0x${ckb.utils.blake160(publicKey, "hex")}`;
  const lockScript = {
    hashType: secp256k1Dep.hashType,
    codeHash: secp256k1Dep.codeHash,
    args: publicKeyHash
  };
  const lockHash = ckb.utils.scriptToHash(lockScript);

  // user b
  const bPubKey = ckb.utils.privateKeyToPublicKey(bPrivKey);
  const bPubKeyHash = `0x${ckb.utils.blake160(bPubKey, "hex")}`;
  const bLockScript = {
    hashType: secp256k1Dep.hashType,
    codeHash: secp256k1Dep.codeHash,
    args: bPubKeyHash
  };
  const bLockHash = ckb.utils.scriptToHash(bLockScript);

  const unspentCells = await ckb.loadCells({
    lockHash
  });
  const totalCapacity = unspentCells.reduce(
    (sum, cell) => sum + BigInt(cell.capacity),
    BigInt(0)
  );
  config.udtScript = {
    codeHash: utils.bytesToHex(simpleUdtHash),
    hashType: "data",
    args: lockHash
  };
  const CellCapacity = 20000000000000n;

  const transaction = {
    version: "0x0",
    cellDeps: [
      {
        outPoint: {
          txHash: config.deployTxHash,
          index: "0x0"
        },
        depType: "code"
      },
      {
        outPoint: secp256k1Dep.outPoint,
        depType: "depGroup"
      }
    ],
    headerDeps: [],
    inputs: unspentCells.map(cell => ({
      previousOutput: cell.outPoint,
      since: "0x0"
    })),
    outputs: [
      {
        lock: lockScript,
        type: null,
        capacity: "0x" + (totalCapacity - fee - CellCapacity).toString(16)
      },
      {
        lock: bLockScript,
        type: config.udtScript,
        capacity: "0x" + CellCapacity.toString(16)
      }
    ],
    witnesses: [
      {
        lock: "",
        inputType: "",
        outputType: ""
      }
    ],
    outputsData: [
      "0x",
      utils.toHexInLittleEndian("0x" + Number(100000000).toString(16), 16)
    ]
  };
  const signedTransaction = ckb.signTransaction(privateKey)(transaction);
  //   console.log(JSON.stringify(signedTransaction, null, 2))

  const txHash = await ckb.rpc.sendTransaction(
    signedTransaction,
    "passthrough"
  );
  config.issueTxHash = txHash;
  console.log(`issue sudt hash: ${txHash}`);
}

async function lockToCrosschainContract() {
  const secp256k1Dep = await ckb.loadSecp256k1Dep();

  // user b
  const bPubKey = ckb.utils.privateKeyToPublicKey(bPrivKey);
  const bPubKeyHash = `0x${ckb.utils.blake160(bPubKey, "hex")}`;
  const bLockScript = {
    hashType: secp256k1Dep.hashType,
    codeHash: secp256k1Dep.codeHash,
    args: bPubKeyHash
  };
  const bLockHash = ckb.utils.scriptToHash(bLockScript);
  //   const mutaCrosschainMsg = {
  //     to: "0x",
  //     amount: 100,
  //   };
  //   const mutaCrosschainMsgWitness = str2hex(JSON.stringify(mutaCrosschainMsg));
  const mutaCrosschainMsgWitness = "0xcff1002107105460941f797828f468667aa1a2db";

  const CellCapacity = 200000000000n;

  const transaction = {
    version: "0x0",
    cellDeps: [
      {
        outPoint: {
          txHash: config.deployTxHash,
          index: "0x0"
        },
        depType: "code"
      },
      {
        outPoint: secp256k1Dep.outPoint,
        depType: "depGroup"
      }
    ],
    headerDeps: [],
    inputs: [
      {
        previousOutput: {
          txHash: config.issueTxHash,
          index: "0x1"
        },
        since: "0x0"
      }
    ],
    outputs: [
      {
        lock: config.crosschainLockscript,
        type: config.udtScript,
        capacity: "0x" + (CellCapacity - 2n * fee).toString(16)
      }
    ],
    witnesses: [
      {
        lock: "",
        inputType: "",
        outputType: ""
      },
      mutaCrosschainMsgWitness
    ],
    outputsData: [
      utils.toHexInLittleEndian("0x" + Number(100000000).toString(16), 16)
    ]
  };
  // console.log(JSON.stringify(transaction, null, 2));
  const signedTransaction = ckb.signTransaction(bPrivKey)(transaction);
  // console.log(JSON.stringify(signedTransaction, null, 2));

  const txHash = await ckb.rpc.sendTransaction(
    signedTransaction,
    "passthrough"
  );
  console.log(`lockToCrosschain hash: ${txHash}`);
  config.lockToCrosschainTxHash = txHash;
  return txHash;
}

async function unlockCrosschainContract() {
  const secp256k1Dep = await ckb.loadSecp256k1Dep();
  // read from the crosschain cell data
  const fee_rate = 100000n;

  const witness = {
    messages: [
      {
        header: {
          height: 100n
        },
        events: [
          {
            asset_id:
                "0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947",
            ckb_receiver:
                "0x0000000000000000000000000000000000000000000000000000000000000001",
            amount: 10000n,
          },
          {
            asset_id:
                "0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947",
            ckb_receiver:
                "0x0000000000000000000000000000000000000000000000000000000000000002",
            amount: 20000n,
          }
        ]
      }
    ],
    proof: "0x" + "00".repeat(64) + "10"
  };

  const msg = SerializeMessageVec( witness.messages )
  const key = new ECPair.default(privateKey, {compressed: false})
  witness.proof = key.signRecoverable(msg.Uint8Array)
  const witness_bytes = SerializeCrosschainWitness(witness)

  const balance = new Object();
  const assetBalanceSum = {};
  const blocks = witness.messages;
  for (let i = 0; i < blocks.length; i++) {
    const events = blocks[i].events;
    for (let j = 0; j < events.length; j++) {
      const event = events[j];
      let asset = balance[event.asset_id] || {};
      asset[event.ckb_receiver] =
        asset[event.ckb_receiver] || BigInt(0) + BigInt(event.amount);
      balance[event.asset_id] = asset;
      assetBalanceSum[event.asset_id] =
        (assetBalanceSum[event.asset_id] || BigInt(0)) + BigInt(event.amount);

      console.log({ event, assetBalanceSum });
    }
  }

  const fee_receiver = witness.fee_receiver;
  for (let asset_id in balance) {
    let fee_total = BigInt(0);
    let asset = balance[asset_id];
    for (let receiver in asset) {
      let fee = (asset[receiver] * fee_rate) / 100000000n;
      fee_total += fee;
      asset[receiver] -= fee;
    }
    asset[fee_receiver] = fee_total;
  }
  console.log({ balance, assetBalanceSum });

  const crosschainLockCells = await ckb.loadCells({
    lockHash: ckb.utils.scriptToHash(config.crosschainLockscript)
  });
  // console.log(JSON.stringify(crosschainLockCells, null, 2));

  const crosschainCell = _.find(
    crosschainLockCells,
    c => c.type.codeHash === config.crosschainTypescript.codeHash
  );
  // console.log(crosschainCell);

  const inputs = [
    {
      previousOutput: crosschainCell.outPoint,
      since: "0x0"
    }
  ];
  let totalCapacity = BigInt(crosschainCell.capacity);
  const udtHashHex = utils.bytesToHex(simpleUdtHash);
  const backToCrosschainBalance = {};
  console.log({ assetBalanceSum });
  for (let i = 0; i < crosschainLockCells.length; i++) {
    const c = crosschainLockCells[i];
    const udtArgs = c.type.args;
    if (c.type.codeHash !== udtHashHex || assetBalanceSum[udtArgs] === null) {
      continue;
    }
    const cellInfo = await ckb.rpc.getLiveCell(c.outPoint, true);
    // console.log(cellInfo);
    const amountRaw = cellInfo.cell.data.content;
    const amount = LittleEndianHexToNum(amountRaw);
    console.log(amount);
    totalCapacity += BigInt(cellInfo.cell.output.capacity);
    inputs.push({
      previousOutput: c.outPoint,
      since: "0x0"
    });
    if (amount >= assetBalanceSum[udtArgs]) {
      backToCrosschainBalance[udtArgs] = amount - assetBalanceSum[udtArgs];
      assetBalanceSum[udtArgs] = null;
    } else {
      assetBalanceSum[udtArgs] -= amount;
    }
  }
  // console.log({ backToCrosschainBalance });

  // console.log(totalCapacity);

  const outputs = [
    {
      lock: crosschainCell.lock,
      type: crosschainCell.type
    }
  ];
  // TODO: transform the crosschain cell data
  const outputsData = ["0x"];

  const udtCellCapacity = 16n * 100000000n + 14100000000n;
  for (const [asset_id, asset] of Object.entries(balance)) {
    let asset = balance[asset_id];
    for (const [receiver, amount] of Object.entries(asset)) {
      let amount = asset[receiver];
      outputs.push({
        lock: {
          args: receiver,
          hashType: secp256k1Dep.hashType,
          codeHash: secp256k1Dep.codeHash
        },
        type: {
          hashType: "data",
          codeHash: utils.bytesToHex(simpleUdtHash),
          args: asset_id
        }
      });
      outputsData.push(utils.toHexInLittleEndian(amount, 16));
    }
  }
  for (const [asset_id, backAmount] of Object.entries(
    backToCrosschainBalance
  )) {
    outputs.push({
      lock: config.crosschainLockscript,
      type: {
        hashType: "data",
        codeHash: utils.bytesToHex(simpleUdtHash),
        args: asset_id
      }
    });
    outputsData.push(utils.toHexInLittleEndian(backAmount, 16));
  }
  for (let i = 0; i < outputs.length; i++) {
    if (i === 0) {
      outputs[i].capacity =
        "0x" +
        (
          totalCapacity -
          udtCellCapacity * BigInt(outputs.length - 1) -
          fee
        ).toString(16);
    } else {
      outputs[i].capacity = "0x" + udtCellCapacity.toString(16);
    }
  }
  // console.log({ outputsData, outputs });
  // console.log(outputsData.slice(1).map(a => LittleEndianHexToNum(a)));
  // console.log(_.sum(outputsData.slice(1).map(a => LittleEndianHexToNum(a))));

  const transaction = {
    version: "0x0",
    cellDeps: [
      {
        outPoint: {
          txHash: config.deployTxHash,
          index: "0x0"
        },
        depType: "code"
      },
      {
        outPoint: {
          txHash: config.deployTxHash,
          index: "0x1"
        },
        depType: "code"
      },
      {
        outPoint: {
          txHash: config.deployTxHash,
          index: "0x2"
        },
        depType: "code"
      },
      {
        outPoint: secp256k1Dep.outPoint,
        depType: "depGroup"
      }
    ],
    headerDeps: [],
    inputs,
    outputs,
    // TODO: witness should encode to molecula
    // witnesses: [str2hex(JSON.stringify(witness))],
    // witnesses: [utils.bytesToHex(new Uint8Array(witness_bytes))],
    witnesses: ["0x0061"],
    outputsData
    // outputsData: [
    //   utils.toHexInLittleEndian("0x" + Number(100000000).toString(16), 16)
    // ]
  };
  // console.log(JSON.stringify(transaction, null, 2));
  const txHash = await ckb.rpc.sendTransaction(transaction, "passthrough");
  console.log(`unlockToCrosschain hash: ${txHash}`);
  config.unlockTxHash = txHash;
  return txHash;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForTx(txHash) {
  while (true) {
    const tx = await ckb.rpc.getTransaction(txHash);
    try {
      console.log(`tx ${txHash} status: ${tx.txStatus.status}`);
      if (tx.txStatus.status === "committed") {
        return;
      }
    } catch (e) {
      console.log({ e, tx, txHash });
    }
    await delay(1000);
  }
}

async function testUnlockCrosschainContract() {
  const secp256k1Dep = await ckb.loadSecp256k1Dep();
  const publicKey = ckb.utils.privateKeyToPublicKey(privateKey);
  const publicKeyHash = `0x${ckb.utils.blake160(publicKey, "hex")}`;
  const lockScript = {
    hashType: secp256k1Dep.hashType,
    codeHash: secp256k1Dep.codeHash,
    args: publicKeyHash
  };
  const lockHash = ckb.utils.scriptToHash(lockScript);

  const unspentCells = await ckb.loadCells({
    lockHash
  });
  const totalCapacity = unspentCells.reduce(
      (sum, cell) => sum + BigInt(cell.capacity),
      BigInt(0)
  );

  config.testTypescript = {
    codeHash: utils.bytesToHex( testTypeBinaryHash ),
    hashType: "data",
    args: "0x"
  }
  const outputs = [
    {
      lock: lockScript,
      type: config.testTypescript,
      capacity: "0x" + CellCapacity.toString(16)
    }
  ]
  outputs.push({
    lock: lockScript,
    type: null,
    capacity: "0x" + (totalCapacity - CellCapacity - fee).toString(16)
  });

  const outputsData = ["0x"]
  outputsData.push("0x");

  const witness = {
    messages: [
      {
        header: {
          height: 100n,
          validator_version: "",
          validators: []
        },
        events: [
          {
            asset_id:
                "0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947",
            ckb_receiver:
                "0x0000000000000000000000000000000000000000000000000000000000000001",
            amount: 10000n,
            nonce: 1n
          },
          {
            asset_id:
                "0x32e555f3ff8e135cece1351a6a2971518392c1e30375c1e006ad0ce8eac07947",
            ckb_receiver:
                "0x0000000000000000000000000000000000000000000000000000000000000002",
            amount: 20000n,
            nonce: 2n
          }
        ],
        proof: "0x" + "00".repeat(65)
      }
    ],
    fee_receiver:
        "0x0000000000000000000000000000000000000000000000000000000000000003"
  };

  const bytes = SerializeCrosschainWitness(witness)
  const uint8Array = new Uint8Array(bytes)


  const transaction = {
    version: "0x0",
    cellDeps: [
      {
        outPoint: secp256k1Dep.outPoint,
        depType: "depGroup"
      },
      {
        outPoint: {
          txHash: config.deployTxHash,
          index: "0x0"
        },
        depType: "code"
      }
    ],
    headerDeps: [],
    inputs: unspentCells.map(cell => ({
      previousOutput: cell.outPoint,
      since: "0x0"
    })),
    outputs,
    witnesses: [ utils.bytesToHex(uint8Array) ],
    outputsData
  };

  const txHash = await ckb.rpc.sendTransaction(
      transaction,
      "passthrough"
  );
  config.testTxHash = txHash;
  console.log(`testTxHash: ${txHash}`);
}

async function main() {
  const binaryList = [
    simpleUdtBinary,
    crosschainTypescript,
    crosschainLockscript
  ];
  await deploy(binaryList);
  await waitForTx(config.deployTxHash);
  await createCrosschainCell();
  await waitForTx(config.createCrosschainCellTxHash);
  await issueSUDT();
  await waitForTx(config.issueTxHash);
  await lockToCrosschainContract();
  await waitForTx(config.lockToCrosschainTxHash);
  await unlockCrosschainContract();
  await waitForTx(config.unlockTxHash);

}

main();
