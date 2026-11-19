# Shows the RStudio sign-in details in every new terminal of the playground.
# Installed to /etc/profile.d by the playground's init task. If RStudio is still
# starting, it waits (Ctrl+C skips) and prints the details once run.sh reports ready.
case $- in *i*) ;; *) return 0 ;; esac

lab_dir=/home/laborant/rstudio-guide
if [ ! -e "$lab_dir/run/ready" ]; then
  printf '\n  RStudio is starting. Its password will appear here when it is ready (Ctrl+C to skip).\n'
  lab_waited=0
  while [ ! -e "$lab_dir/run/ready" ] && [ "$lab_waited" -lt 600 ]; do sleep 2; lab_waited=$((lab_waited + 2)); done
  unset lab_waited
fi
if [ -e "$lab_dir/run/ready" ] && [ -r "$lab_dir/run/.env" ]; then
  printf '\n  RStudio is running the %s scenario. Open the RStudio tab and sign in:\n\n    Username: rstudio\n    Password: %s\n\n  Switch scenario: cd %s && ./run.sh up graphical-tools  (or statistical-tools)\n\n' \
    "$(sed -n 's/^LAB_SCENARIO=//p' "$lab_dir/run/.env")" \
    "$(sed -n 's/^RSTUDIO_PASSWORD=//p' "$lab_dir/run/.env")" \
    "$lab_dir"
else
  printf '\n  RStudio is not ready yet. Open a new terminal later to see its password.\n\n'
fi
unset lab_dir
