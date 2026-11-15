import subprocess,time,sys
cmd=sys.argv[2:]; mark=sys.argv[1].encode()
for i in range(5):
    t0=time.monotonic(); p=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT); tm=None
    for line in p.stdout:
        if tm is None and mark in line: tm=time.monotonic()
    p.wait(); t1=time.monotonic()
    print(f"run {i+1}: to-marker {((tm or t1)-t0)*1000:.0f} ms, to-exit {(t1-t0)*1000:.0f} ms, found={tm is not None}")
