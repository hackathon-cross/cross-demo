# cross-demo

## quick start

```
# ckb version used: v0.30.1
# https://github.com/nervosnetwork/ckb/releases/tag/v0.30.1
# Download on Mac: wget https://github.com/nervosnetwork/ckb/releases/download/v0.30.1/ckb_v0.30.1_x86_64-apple-darwin.zip
# unzip and add the binary path to system PATH

# run ckb
$ ckb init -c dev -C ckb-data --ba-arg 0x5a7487f529b8b8fd4d4a57c12dc0c70f7958a196
$ ckb run -C ckb-data
$ ckb miner -C ckb-data

# run simple scripts demo
$ node deploy/demo.js

# run full demo with relayer and muta

```