param([string]$Mode='voices',[string]$InputFile,[string]$OutputFile)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Speech
$rinSynth=New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  if($Mode -eq 'voices') {
    $rinVoices=@($rinSynth.GetInstalledVoices() | Where-Object Enabled | ForEach-Object {
      @{name=$_.VoiceInfo.Name;lang=$_.VoiceInfo.Culture.Name;gender=$_.VoiceInfo.Gender.ToString()}
    })
    ConvertTo-Json -InputObject $rinVoices -Compress
  } else {
    $rinRequest=Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if($rinRequest.voice) { $rinSynth.SelectVoice([string]$rinRequest.voice) }
    $rinSynth.Rate=[int]$rinRequest.rate
    $rinSynth.SetOutputToWaveFile($OutputFile)
    $rinSynth.Speak([string]$rinRequest.text)
  }
} finally { $rinSynth.Dispose() }
