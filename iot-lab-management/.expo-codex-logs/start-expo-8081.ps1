$ErrorActionPreference = "Continue"
Set-Location "C:\Users\JimmyReal\Documents\GitHub\Project1\iot-lab-management"
& "C:\Users\JimmyReal\Documents\GitHub\Project1\iot-lab-management\node_modules\.bin\expo.cmd" start --web --offline --port 8081 *>&1 |
  Tee-Object -FilePath "C:\Users\JimmyReal\Documents\GitHub\Project1\iot-lab-management\.expo-codex-logs\expo-8081.log"
