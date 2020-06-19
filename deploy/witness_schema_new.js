const utils = require("@nervosnetwork/ckb-sdk-utils");



function dataLengthError(actual, required) {
    throw new Error(`Invalid data length! Required: ${required}, actual: ${actual}`);
}

function assertDataLength(actual, required) {
  if (actual !== required) {
    dataLengthError(actual, required);
  }
}

function assertArrayBuffer(reader) {
  if (reader instanceof Object && reader.toArrayBuffer instanceof Function) {
    reader = reader.toArrayBuffer();
  }
  if (!(reader instanceof ArrayBuffer)) {
    throw new Error("Provided value must be an ArrayBuffer or can be transformed into ArrayBuffer!");
  }
  return reader;
}

function verifyAndExtractOffsets(view, expectedFieldCount, compatible) {
  if (view.byteLength < 4) {
    dataLengthError(view.byteLength, ">4");
  }
  const requiredByteLength = view.getUint32(0, true);
  assertDataLength(view.byteLength, requiredByteLength);
  if (requiredByteLength === 4) {
    return [requiredByteLength];
  }
  if (requiredByteLength < 8) {
    dataLengthError(view.byteLength, ">8");
  }
  const firstOffset = view.getUint32(4, true);
  if (firstOffset % 4 !== 0 || firstOffset < 8) {
    throw new Error(`Invalid first offset: ${firstOffset}`);
  }
  const itemCount = firstOffset / 4 - 1;
  if (itemCount < expectedFieldCount) {
    throw new Error(`Item count not enough! Required: ${expectedFieldCount}, actual: ${itemCount}`);
  } else if ((!compatible) && itemCount > expectedFieldCount) {
    throw new Error(`Item count is more than required! Required: ${expectedFieldCount}, actual: ${itemCount}`);
  }
  if (requiredByteLength < firstOffset) {
    throw new Error(`First offset is larger than byte length: ${firstOffset}`);
  }
  const offsets = [];
  for (let i = 0; i < itemCount; i++) {
    const start = 4 + i * 4;
    offsets.push(view.getUint32(start, true));
  }
  offsets.push(requiredByteLength);
  for (let i = 0; i < offsets.length - 1; i++) {
    if (offsets[i] > offsets[i + 1]) {
      throw new Error(`Offset index ${i}: ${offsets[i]} is larger than offset index ${i + 1}: ${offsets[i + 1]}`);
    }
  }
  return offsets;
}

function serializeTable(buffers) {
  const itemCount = buffers.length;
  let totalSize = 4 * (itemCount + 1);
  const offsets = [];

  for (let i = 0; i < itemCount; i++) {
    offsets.push(totalSize);
    totalSize += buffers[i].byteLength;
  }

  const buffer = new ArrayBuffer(totalSize);
  const array = new Uint8Array(buffer);
  const view = new DataView(buffer);

  view.setUint32(0, totalSize, true);
  for (let i = 0; i < itemCount; i++) {
    view.setUint32(4 + i * 4, offsets[i], true);
    array.set(new Uint8Array(buffers[i]), offsets[i]);
  }
  return buffer;
}

class Uint64 {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    assertDataLength(this.view.byteLength, 8);
  }

  indexAt(i) {
    return this.view.getUint8(i);
  }

  raw() {
    return this.view.buffer;
  }

  static size() {
    return 8;
  }
}

function SerializeUint64(value) {
  const dv = new DataView(new ArrayBuffer(8))
  dv.setBigUint64(0, value, true)

  const buffer = assertArrayBuffer(dv.buffer);
  assertDataLength(buffer.byteLength, 8);
  return buffer;
}

class Byte32 {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    assertDataLength(this.view.byteLength, 32);
  }

  indexAt(i) {
    return this.view.getUint8(i);
  }

  raw() {
    return this.view.buffer;
  }

  static size() {
    return 32;
  }
}

function SerializeByte32(value) {
  value = utils.hexToBytes(value)
  const buffer = assertArrayBuffer(value.buffer);
  assertDataLength(buffer.byteLength, 32);
  return buffer;
}

class Signature {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    assertDataLength(this.view.byteLength, 65);
  }

  indexAt(i) {
    return this.view.getUint8(i);
  }

  raw() {
    return this.view.buffer;
  }

  static size() {
    return 65;
  }
}

function SerializeSignature(value) {
  value = utils.hexToBytes(value)
  const buffer = assertArrayBuffer(value.buffer);
  assertDataLength(buffer.byteLength, 65);
  return buffer;
}

class EventsVec {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    if (this.view.byteLength < 4) {
      dataLengthError(this.view.byteLength, ">4");
    }
    const requiredByteLength = this.length() * Event.size() + 4;
    assertDataLength(this.view.byteLength, requiredByteLength);
    for (let i = 0; i < 0; i++) {
      const item = this.indexAt(i);
      item.validate(compatible);
    }
  }

  indexAt(i) {
    return new Event(this.view.buffer.slice(4 + i * Event.size(), 4 + (i + 1) * Event.size()), { validate: false });
  }

  length() {
    return this.view.getUint32(0, true);
  }
}

function SerializeEventsVec(value) {
  const array = new Uint8Array(4 + Event.size() * value.length);
  (new DataView(array.buffer)).setUint32(0, value.length, true);
  for (let i = 0; i < value.length; i++) {
    const itemBuffer = SerializeEvent(value[i]);
    array.set(new Uint8Array(itemBuffer), 4 + i * Event.size());
  }
  return array.buffer;
}

class MessageVec {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    const offsets = verifyAndExtractOffsets(this.view, 0, true);
    for (let i = 0; i < len(offsets) - 1; i++) {
      new Message(this.view.buffer.slice(offsets[i], offsets[i + 1]), { validate: false }).validate();
    }
  }

  length() {
    if (this.view.byteLength < 8) {
      return 0;
    } else {
      return this.view.getUint32(4, true) / 4 - 1;
    }
  }

  indexAt(i) {
    const start = 4 + i * 4;
    const offset = this.view.getUint32(start, true);
    let offset_end = this.view.byteLength;
    if (i + 1 < this.length()) {
      offset_end = this.view.getUint32(start + 4, true);
    }
    return new Message(this.view.buffer.slice(offset, offset_end), { validate: false });
  }
}

function SerializeMessageVec(value) {
  return serializeTable(value.map(item => SerializeMessage(item)));
}

class Event {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  getAssetId() {
    return new Byte32(this.view.buffer.slice(0, 0 + Byte32.size()), { validate: false });
  }

  getCkbReceiver() {
    return new Byte32(this.view.buffer.slice(0 + Byte32.size(), 0 + Byte32.size() + Byte32.size()), { validate: false });
  }

  getAmount() {
    return new Uint64(this.view.buffer.slice(0 + Byte32.size() + Byte32.size(), 0 + Byte32.size() + Byte32.size() + Uint64.size()), { validate: false });
  }

  validate(compatible = false) {
    assertDataLength(this.view.byteLength, Event.size());
    this.getAssetId().validate(compatible);
    this.getCkbReceiver().validate(compatible);
    this.getAmount().validate(compatible);
  }
  static size() {
    return 0 + Byte32.size() + Byte32.size() + Uint64.size();
  }
}

function SerializeEvent(value) {
  const array = new Uint8Array(0 + Byte32.size() + Byte32.size() + Uint64.size());
  const view = new DataView(array.buffer);
  array.set(new Uint8Array(SerializeByte32(value.asset_id)), 0);
  array.set(new Uint8Array(SerializeByte32(value.ckb_receiver)), 0 + Byte32.size());
  array.set(new Uint8Array(SerializeUint64(value.amount)), 0 + Byte32.size() + Byte32.size());
  return array.buffer;
}

class Header {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  getHeight() {
    return new Uint64(this.view.buffer.slice(0, 0 + Uint64.size()), { validate: false });
  }

  validate(compatible = false) {
    assertDataLength(this.view.byteLength, Header.size());
    this.getHeight().validate(compatible);
  }
  static size() {
    return 0 + Uint64.size();
  }
}

function SerializeHeader(value) {
  const array = new Uint8Array(0 + Uint64.size());
  const view = new DataView(array.buffer);
  array.set(new Uint8Array(SerializeUint64(value.height)), 0);
  return array.buffer;
}

class Message {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    const offsets = verifyAndExtractOffsets(this.view, 0, true);
    new Header(this.view.buffer.slice(offsets[0], offsets[1]), { validate: false }).validate();
    new EventsVec(this.view.buffer.slice(offsets[1], offsets[2]), { validate: false }).validate();
  }

  getHeader() {
    const start = 4;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new Header(this.view.buffer.slice(offset, offset_end), { validate: false });
  }

  getEvents() {
    const start = 8;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.byteLength;
    return new EventsVec(this.view.buffer.slice(offset, offset_end), { validate: false });
  }
}

function SerializeMessage(value) {
  const buffers = [];
  buffers.push(SerializeHeader(value.header));
  buffers.push(SerializeEventsVec(value.events));
  return serializeTable(buffers);
}

class CrosschainWitness {
  constructor(reader, { validate = true } = {}) {
    this.view = new DataView(assertArrayBuffer(reader));
    if (validate) {
      this.validate();
    }
  }

  validate(compatible = false) {
    const offsets = verifyAndExtractOffsets(this.view, 0, true);
    new MessageVec(this.view.buffer.slice(offsets[0], offsets[1]), { validate: false }).validate();
    new Signature(this.view.buffer.slice(offsets[1], offsets[2]), { validate: false }).validate();
  }

  getMessages() {
    const start = 4;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.getUint32(start + 4, true);
    return new MessageVec(this.view.buffer.slice(offset, offset_end), { validate: false });
  }

  getProof() {
    const start = 8;
    const offset = this.view.getUint32(start, true);
    const offset_end = this.view.byteLength;
    return new Signature(this.view.buffer.slice(offset, offset_end), { validate: false });
  }
}

function SerializeCrosschainWitness(value) {
  const buffers = [];
  buffers.push(SerializeMessageVec(value.messages));
  buffers.push(SerializeSignature(value.proof));
  return serializeTable(buffers);
}

module.exports = { SerializeCrosschainWitness }