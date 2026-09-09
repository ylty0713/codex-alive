import sys,json,wave
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'stt-deps'))
from vosk import Model,KaldiRecognizer,SetLogLevel
SetLogLevel(-1)
with wave.open(sys.argv[1],'rb') as source:
    if source.getnchannels()!=1 or source.getsampwidth()!=2 or source.getframerate()!=16000:raise ValueError('Expected 16kHz mono PCM')
    model=Model(str(Path(__file__).resolve().parents[1]/'assets/stt/vosk-model-small-cn-0.22'))
    recognizer=KaldiRecognizer(model,16000);parts=[]
    while data:=source.readframes(4000):
        if recognizer.AcceptWaveform(data):parts.append(json.loads(recognizer.Result()).get('text',''))
    parts.append(json.loads(recognizer.FinalResult()).get('text',''))
    print(json.dumps({'text':''.join(parts).replace(' ','')},ensure_ascii=True))
