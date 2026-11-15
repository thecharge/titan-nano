#!/usr/bin/env bash
# Usage: FC_DIR=<dir with vmlinux, rootfs-run.ext4, vm.json> bash environment-check.sh
set -u
H=$(dirname "$0")
echo "date: $(date -Is)"; echo "kernel: $(uname -r)"; echo "cpus: $(nproc)"; free -g | head -2
echo "kvm: $(test -r /dev/kvm -a -w /dev/kvm && echo read-write || echo no-access)"
echo "cpu virt flags count: $(grep -c -E 'vmx|svm' /proc/cpuinfo)"
sysctl kernel.apparmor_restrict_unprivileged_userns 2>&1
echo "bun: $(bun --version)"; echo "firecracker: $(firecracker --version 2>&1 | head -1)"; echo "podman: $(podman --version)"
for rt in crun runc runsc kata krun; do printf "runtime %s: " $rt; podman run --rm --network=none --runtime $rt docker.io/library/alpine:latest true >/dev/null 2>&1 && echo installed || echo NOT-installed; done
printf "bwrap net-unshare: "; bwrap --ro-bind /usr /usr --symlink usr/bin /bin --symlink usr/lib /lib --symlink usr/lib64 /lib64 --proc /proc --dev /dev --unshare-all true 2>&1 | head -1
echo "== firecracker v1.7 CI kernel 5.10.209 + ubuntu-22.04 rootfs, 1 vCPU, 256 MiB, cold boot to init marker"
python3 -I "$H/time_to_marker.py" FC_READY sh -c "rm -f $FC_DIR/fc.sock; exec firecracker --no-api --config-file $FC_DIR/vm.json --api-sock $FC_DIR/fc.sock"
echo "== podman/crun alpine, --network=none --cap-drop=ALL --read-only"
python3 -I "$H/time_to_marker.py" CT_READY podman run --rm --network=none --cap-drop=ALL --read-only docker.io/library/alpine:latest sh -c 'echo CT_READY'
