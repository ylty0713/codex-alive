import sys,asyncio,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'tts-deps'))
import edge_tts
async def main():
    request=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    voice=request.get('voice','zh-CN-XiaoyiNeural')
    catalog=json.loads((Path(__file__).parent/'voices.json').read_text(encoding='utf-8'))
    if voice not in [v['name'] for v in catalog]:raise ValueError('Unsupported voice')
    rate=max(-50,min(50,int(request.get('rate',-6))))
    pitch=max(-30,min(30,int(request.get('pitch',0))))
    communicate=edge_tts.Communicate(request['text'].replace('凛','林'),voice,rate=f'{rate:+d}%',pitch=f'{pitch:+d}Hz',boundary='WordBoundary',connect_timeout=10,receive_timeout=30)
    timing=[]
    with open(sys.argv[2],'wb') as audio:
        async for chunk in communicate.stream():
            if chunk['type']=='audio':audio.write(chunk['data'])
            elif chunk['type']=='WordBoundary':timing.append({'start':chunk['offset']/10000000,'duration':chunk['duration']/10000000,'text':chunk['text']})
    Path(sys.argv[2]+'.json').write_text(json.dumps(timing),encoding='utf-8')
asyncio.run(main())
