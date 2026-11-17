$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime] | Out-Null
[Windows.Media.SpeechSynthesis.SpeechSynthesisStream, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime] | Out-Null
$voices = @([Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices)
if ($payload.action -eq 'voices') {
    $result = @($voices | ForEach-Object { @{ name = $_.DisplayName; language = $_.Language } })
    ConvertTo-Json -InputObject $result -Compress
    exit 0
}
$language = ([string]$payload.language).ToLowerInvariant()
$voice = $voices | Where-Object { $_.Language.ToLowerInvariant() -eq $language } | Select-Object -First 1
if (!$voice) {
    $voice = $voices | Where-Object { $_.Language.Split('-')[0].ToLowerInvariant() -eq $language.Split('-')[0] } | Select-Object -First 1
}
if (!$voice) { throw 'No installed Windows voice matches the requested language.' }
$synthesizer = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::new()
$speech = $null
$inputStream = $null
$managedStream = $null
$memory = [System.IO.MemoryStream]::new()
try {
    $synthesizer.Voice = $voice
    $operation = $synthesizer.SynthesizeTextToStreamAsync([string]$payload.text)
    $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } | Select-Object -First 1
    $task = $asTask.MakeGenericMethod([Windows.Media.SpeechSynthesis.SpeechSynthesisStream]).Invoke($null, @($operation))
    $speech = $task.GetAwaiter().GetResult()
    $inputStream = $speech.GetInputStreamAt(0)
    $managedStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($inputStream)
    $managedStream.CopyTo($memory)
    @{ audio = [Convert]::ToBase64String($memory.ToArray()); voice = $voice.DisplayName; language = $voice.Language } | ConvertTo-Json -Compress
} finally {
    $memory.Dispose()
    if ($managedStream) { $managedStream.Dispose() }
    if ($inputStream) { $inputStream.Dispose() }
    if ($speech) { $speech.Dispose() }
    $synthesizer.Dispose()
}
