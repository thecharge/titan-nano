#!/bin/sh
echo FC_READY $(uname -r)
exec /sbin/reboot -f
