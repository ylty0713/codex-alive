import sys,json,base64
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'stt-deps'))
from vosk import Model,KaldiRecognizer,SetLogLevel
SetLogLevel(-1)
model=Model(str(Path(__file__).resolve().parents[1]/'assets/stt/vosk-model-small-cn-0.22'))
recognizer=KaldiRecognizer(model,16000)
wake_recognizer=KaldiRecognizer(model,16000,json.dumps(['林','[unk]'],ensure_ascii=False))
wake_sent=False
print(json.dumps({'type':'ready'}),flush=True)
for line in sys.stdin:
    try:
        packet=json.loads(line)
        if packet.get('reset'):
            recognizer.Reset();wake_recognizer.Reset();wake_sent=False
            continue
        pcm=base64.b64decode(packet['audio'])
        wake_final=wake_recognizer.AcceptWaveform(pcm)
        wake_result=json.loads(wake_recognizer.Result() if wake_final else wake_recognizer.PartialResult())
        wake_text=wake_result.get('text',wake_result.get('partial','')).strip()
        if not wake_sent and wake_text.startswith('林'):
            print(json.dumps({'type':'wake'}),flush=True)
            wake_sent=True
        final=recognizer.AcceptWaveform(pcm)
        result=json.loads(recognizer.Result() if final else recognizer.PartialResult())
        text=result.get('text',result.get('partial','')).replace(' ','')
        if text:print(json.dumps({'type':'final' if final else 'partial','text':text},ensure_ascii=True),flush=True)
        if final:
            wake_recognizer.Reset();wake_sent=False
    except Exception as e:print(json.dumps({'type':'error','message':str(e)}),flush=True)
