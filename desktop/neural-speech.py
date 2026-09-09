import sys,asyncio,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'tts-deps'))
import edge_tts
async def main():
    request=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    voice=request.get('voice','zh-CN-XiaoyiNeural')
    if voice not in ['zh-CN-XiaoxiaoNeural','zh-CN-XiaoyiNeural']:raise ValueError('Unsupported voice')
    communicate=edge_tts.Communicate(request['text'].replace('凛','林'),voice,rate='-6%',pitch='+0Hz',boundary='WordBoundary',connect_timeout=10,receive_timeout=30)
    timing=[]
    with open(sys.argv[2],'wb') as audio:
        async for chunk in communicate.stream():
            if chunk['type']=='audio':audio.write(chunk['data'])
            elif chunk['type']=='WordBoundary':timing.append({'start':chunk['offset']/10000000,'duration':chunk['duration']/10000000,'text':chunk['text']})
    Path(sys.argv[2]+'.json').write_text(json.dumps(timing),encoding='utf-8')
asyncio.run(main())
