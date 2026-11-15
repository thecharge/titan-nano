#!/usr/bin/env bash
# Usage: FC_DIR=<dir with vmlinux and rootfs-snap.ext4 containing /hbinit> bash firecracker-snapshot.sh
set -u
D=$(mktemp -d /tmp/fcXXXX); A=$D/a.sock; B=$D/b.sock; cd "$FC_DIR"; rm -f snap.vmstate snap.mem
api(){ curl -s --unix-socket $1 -X $2 "http://localhost$3" -H 'Content-Type: application/json' -d "$4" -o /dev/null -w '%{http_code}'; }
firecracker --api-sock $A > boot.log 2>&1 & FP=$!; sleep 0.2
api $A PUT /boot-source "{\"kernel_image_path\":\"$FC_DIR/vmlinux\",\"boot_args\":\"console=ttyS0 reboot=k panic=1 pci=off quiet init=/hbinit\"}" >/dev/null
api $A PUT /drives/rootfs "{\"drive_id\":\"rootfs\",\"path_on_host\":\"$FC_DIR/rootfs-snap.ext4\",\"is_root_device\":true,\"is_read_only\":false}" >/dev/null
api $A PUT /machine-config '{"vcpu_count":1,"mem_size_mib":256}' >/dev/null
api $A PUT /actions '{"action_type":"InstanceStart"}' >/dev/null
sleep 2; echo "heartbeats before snapshot: $(grep -c HB boot.log)"
api $A PATCH /vm '{"state":"Paused"}' >/dev/null
s=$(date +%s%N); api $A PUT /snapshot/create "{\"snapshot_type\":\"Full\",\"snapshot_path\":\"$FC_DIR/snap.vmstate\",\"mem_file_path\":\"$FC_DIR/snap.mem\"}" >/dev/null; echo "snapshot create: $(( ($(date +%s%N)-s)/1000000 )) ms; mem file $(stat -c %s snap.mem) bytes"
kill $FP; wait $FP 2>/dev/null
for i in 1 2 3 4 5; do rm -f $B
  s=$(date +%s%N); firecracker --api-sock $B > rest.log 2>&1 & RP=$!
  while [ ! -S $B ]; do sleep 0.001; done
  c=$(api $B PUT /snapshot/load "{\"snapshot_path\":\"$FC_DIR/snap.vmstate\",\"mem_backend\":{\"backend_type\":\"File\",\"backend_path\":\"$FC_DIR/snap.mem\"},\"enable_diff_snapshots\":false,\"resume_vm\":true}")
  t1=$(( ($(date +%s%N)-s)/1000000 ))
  n0=$(grep -c HB rest.log); while [ "$(grep -c HB rest.log)" -le "$n0" ]; do sleep 0.001; done
  t2=$(( ($(date +%s%N)-s)/1000000 ))
  echo "restore $i: http $c; process start -> load+resume returned ${t1} ms; -> first guest heartbeat after restore ${t2} ms"
  kill $RP; wait $RP 2>/dev/null; done
rm -rf $D
