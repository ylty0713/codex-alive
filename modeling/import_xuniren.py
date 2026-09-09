"""Read a restricted subset of Maya ASCII as DATA, never execute MEL/Python.
Imports source mesh cages, UVs, material maps and bind-space skin weights.
Maya DG evaluation, control rigs and XGen generation are deliberately absent.
"""
import bpy,re,json,math,hashlib
from pathlib import Path
from collections import defaultdict
from mathutils import Matrix,Vector,Euler
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/source-models/xuniren-maya/XuNiren_jl/JL'
OUT=ROOT/'assets/xuniren';OUT.mkdir(exist_ok=True)
source=SRC/'scenes/xuniren_Rig.ma'
text=source.read_text(encoding='gb18030',errors='strict')
headers=list(re.finditer(r'^createNode (\w+)[^;]*;',text,re.M))
nodes={};removed=[];spans=[]
for i,h in enumerate(headers):
    header=h.group();name=re.search(r'-n "([^"]+)"',header)
    if not name:continue
    name=name.group(1);parent=re.search(r'-p "([^"]+)"',header)
    end=headers[i+1].start() if i+1<len(headers) else len(text)
    # Stop at the first global statement rather than swallowing connections.
    tail=text[h.end():end];stop=re.search(r'^(?:connectAttr|select |relationship|fileInfo|currentUnit)',tail,re.M)
    if stop:end=h.end()+stop.start()
    block=text[h.start():end]
    if h.group(1)=='script':removed.append(name);spans.append((h.start(),end));continue
    nodes[name]={'type':h.group(1),'parent':parent.group(1) if parent else None,'block':block}
clean=text
for a,b in reversed(spans):clean=clean[:a]+clean[b:]
clean=re.sub(r'^connectAttr[^;]*(?:'+ '|'.join(re.escape(n) for n in removed)+r')[^;]*;\s*','',clean,flags=re.M)
safe=SRC/'scenes/xuniren_Rig_NO_SCRIPT_NODES.ma';safe.write_text(clean,encoding='gb18030')
# This copy is for data inspection, not a blanket security certification.
report={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'removed_script_nodes':removed,'meshes':{},'limitations':['No Maya dependency-graph or control-rig evaluation.','Bind-space base mesh import; Maya corrective blendshapes not yet converted.','XGen guide curves preserved separately; final XGen hair is not generated.','Iray/Arnold/Redshift shaders replaced by approximate Principled materials.']}
connections=re.findall(r'^connectAttr\s+"([^"]+)"\s+"([^"]+)"[^;]*;',clean,re.M)
incoming=defaultdict(list);outgoing=defaultdict(list)
for a,b in connections:incoming[b.split('.')[0]].append((a,b));outgoing[a.split('.')[0]].append((a,b))
NUM=r'[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?'
def nums(s):return [float(x) for x in re.findall(NUM,s)]
def attr(name,key,default=None):
    b=nodes.get(name,{}).get('block','');m=re.search(r'setAttr[^;]*?"'+re.escape(key)+r'"\s+(?:-type\s+"[^"]+"\s+)?([^;]*);',b)
    return nums(m.group(1)) if m else default
def array(name,key,width):
    b=nodes[name]['block'];result=[]
    for m in re.finditer(r'setAttr[^;]*?"'+re.escape(key)+r'\[(\d+)(?::(\d+))?\]"\s+(?:-type "[^"]+"\s+)?([^;]*);',b):
        start=int(m[1]);vals=nums(m[3]);assert len(vals)%width==0,(name,key)
        rows=[vals[i:i+width] for i in range(0,len(vals),width)]
        while len(result)<start+len(rows):result.append(None)
        result[start:start+len(rows)]=rows
    return result
def maya_matrix(values):return Matrix([values[i:i+4] for i in range(0,16,4)]).transposed()
C=Matrix(((.01,0,0,0),(0,0,-.01,0),(0,.01,0,0),(0,0,0,1)))
cache={}
def world(name):
    if name not in nodes:return Matrix.Identity(4)
    if name in cache:return cache[name]
    n=nodes[name];t=Vector(attr(name,'.t',[0,0,0]));r=attr(name,'.r',[0,0,0]);scale=attr(name,'.s',[1,1,1]);rp=Vector(attr(name,'.rp',[0,0,0]));sp=Vector(attr(name,'.sp',[0,0,0]))
    rot=Euler([math.radians(x) for x in r],'XYZ').to_matrix().to_4x4()
    mat=Matrix.Translation(t)@Matrix.Translation(rp)@rot@Matrix.Translation(-rp)@Matrix.Translation(sp)@Matrix.Diagonal((*scale,1))@Matrix.Translation(-sp)
    if n['parent'] and not re.search(r'setAttr[^;]*"\.it" no;',n['block']):mat=world(n['parent'])@mat
    cache[name]=mat;return mat
def in_geometry(name):
    seen=set()
    while name and name in nodes and name not in seen:
        seen.add(name)
        if name=='Geometry':return True
        name=nodes[name]['parent']
    return False
def skin_for(shape):
    sets=[b.split('.')[0] for a,b in outgoing[shape] if '.iog' in a and nodes.get(b.split('.')[0],{}).get('type')=='objectSet']
    skins=[]
    for se in sets:
        for a,b in incoming[se]:
            if nodes.get(a.split('.')[0],{}).get('type')=='skinCluster':skins.append(a.split('.')[0])
    return next(iter(dict.fromkeys(skins)),None)
skin_cache={}
def skin_data(name):
    if name in skin_cache:return skin_cache[name]
    influences={}
    for a,b in incoming[name]:
        m=re.search(r'\.ma\[(\d+)\]',b)
        if m:influences[int(m[1])]=a.split('.')[0]
    weights={};block=nodes[name]['block']
    for m in re.finditer(r'setAttr "\.wl\[(\d+):(\d+)\]\.w"([^;]*);',block):
        vals=nums(m[3]);i=0
        for vi in range(int(m[1]),int(m[2])+1):
            count=int(vals[i]);i+=1;row=[]
            for _ in range(count):row.append((int(vals[i]),vals[i+1]));i+=2
            weights[vi]=row
        assert i==len(vals)
    for m in re.finditer(r'setAttr[^;]*?"\.wl\[(\d+)\]\.w\[(\d+)(?::(\d+))?\]"\s+([^;]*);',block):
        row=weights.setdefault(int(m[1]),[])
        row.extend((int(m[2])+j,w) for j,w in enumerate(nums(m[4])))
    bind={}
    for idx,bone in influences.items():
        pm=attr(name,f'.pm[{idx}]')
        if pm and len(pm)==16:bind[bone]=maya_matrix(pm).inverted_safe()
    result=(influences,weights,bind);skin_cache[name]=result;return result

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
cols={}
for name in ['01_BODY','02_CLOTHING','03_XGEN_GUIDES_NOT_FINAL_HAIR','04_ACCESSORIES','90_STAGE']:
    col=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(col);cols[name]=col
meshes=[]
for name,n in nodes.items():
    extra=n['parent'] in ['Eye_L_Model','Eye_Bai_L_Model','kouqiang_up','kouqiang_down','shetou','Mm','UP','Down']
    if n['type']!='mesh' or not (in_geometry(n['parent']) or extra) or not array(name,'.vt',3):continue
    parent=n['parent'];siblings=[k for k,v in nodes.items() if v['type']=='mesh' and v['parent']==parent]
    live=next((k for k in siblings if not re.search(r'setAttr "\.io" yes;',nodes[k]['block'])),name)
    if any(p['parent']==parent for p in meshes):continue
    meshes.append({'name':name,'parent':parent,'live':live,'skin':skin_for(live)})
meshes.sort(key=lambda p:0 if p['parent']=='Body_Model' else 1)
binds={};parents={}
for part in meshes:
    if part['skin']:
        inf,w,bind=skin_data(part['skin'])
        for bone,mat in bind.items():binds.setdefault(bone,mat)
arm=bpy.data.armatures.new('XuNiren_Source_Bind_Skeleton');rig=bpy.data.objects.new('XuNiren_Rig',arm);cols['01_BODY'].objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,mat in binds.items():
    b=arm.edit_bones.new(name);pos=(C@mat).translation;b.head=pos
    direction=(C.to_3x3()@mat.to_3x3()@Vector((1,0,0))).normalized();b.tail=pos+direction*.025
for name in binds:
    p=nodes.get(name,{}).get('parent');seen=set()
    while p and p not in binds and p not in seen:
        seen.add(p);p=nodes.get(p,{}).get('parent')
    if p in binds:arm.edit_bones[name].parent=arm.edit_bones[p]
bpy.ops.object.mode_set(mode='OBJECT')
file_index={p.name.lower():p for p in SRC.rglob('*') if p.is_file()}
material_cache={}
def upstream_file(node,seen=None):
    seen=set() if seen is None else seen
    if node in seen:return None
    seen.add(node)
    if nodes.get(node,{}).get('type')=='file':
        m=re.search(r'"\.ftn" -type "string" "([^"]+)"',nodes[node]['block'])
        return file_index.get(m[1].replace('\\','/').split('/')[-1].lower()) if m else None
    for a,b in incoming[node]:
        if any(x in b for x in ['.msg','.cme','.cmcf','.uv']):continue
        found=upstream_file(a.split('.')[0],seen)
        if found:return found
def mat_for(live):
    sg=next((b.split('.')[0] for a,b in outgoing[live] if '.iog' in a and nodes.get(b.split('.')[0],{}).get('type')=='shadingEngine'),None)
    shader=next((a.split('.')[0] for a,b in incoming[sg] if b.endswith('.ss')),None) if sg else None
    name=shader or 'Unassigned'
    if name in material_cache:return material_cache[name]
    mat=bpy.data.materials.new(name);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.6
    base=attr(shader,'.base_color',attr(shader,'.c',[.55,.45,.4])) if shader else [.55,.45,.4]
    if len(base)!=3:base=[.55,.45,.4]
    bs.inputs['Base Color'].default_value=(*base,1);mat.diffuse_color=(*base,1)
    for a,b in incoming[shader]:
        dest=b.split('.',1)[-1]
        slot={'base_color':'Base Color','c':'Base Color','specular_roughness':'Roughness','metalness':'Metallic','n':'Normal'}.get(dest)
        if not slot:continue
        path=upstream_file(a.split('.')[0])
        if not path or path.suffix.lower()=='.iff':continue
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(path),check_existing=True)
        if slot!='Base Color':tex.image.colorspace_settings.name='Non-Color'
        if slot=='Normal':
            norm=mat.node_tree.nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.5;mat.node_tree.links.new(tex.outputs['Color'],norm.inputs['Color']);mat.node_tree.links.new(norm.outputs[0],bs.inputs['Normal'])
        else:mat.node_tree.links.new(tex.outputs['Color'],bs.inputs[slot])
    if 'bai' in name.lower() or 'cornea' in name.lower():bs.inputs['Base Color'].default_value=(.9,.9,.9,1)
    material_cache[name]=mat;return mat

for part in meshes:
    name,parent,live=part['name'],part['parent'],part['live'];verts=array(name,'.vt',3);edges=array(name,'.ed',3);uvs=array(name,'.uvst[0].uvsp',2)
    # Maya stores edited/mirrored geometry as sparse offsets on the original
    # shape. Omitting .pt would overlap mirrored eyes/shoes and displace mouths.
    point_offsets=array(name,'.pt',3)
    for i,delta in enumerate(point_offsets):
        if delta is not None and i<len(verts):verts[i]=[a+b for a,b in zip(verts[i],delta)]
    faces=[];faceuv=[]
    for m in re.finditer(r'"\.fc\[\d+(?::\d+)?\]"\s+(?:-type "polyFaces"\s+)?([^;]*);',nodes[name]['block']):
        for line in m[1].splitlines():
            tokens=line.strip().split()
            if not tokens:continue
            if tokens[0]=='f':
                eids=[int(x) for x in tokens[2:]];assert len(eids)==int(tokens[1]);faces.append([int(edges[e][0]) if e>=0 else int(edges[-e-1][1]) for e in eids]);faceuv.append([])
            elif tokens[0]=='mu' and tokens[1]=='0':faceuv[-1]=[int(x) for x in tokens[3:]]
    if not faces:continue
    transform=world(parent)
    if part['skin']:
        gm=attr(part['skin'],'.gm')
        if gm and len(gm)==16:transform=maya_matrix(gm)
    coords=[C@transform@Vector(v) for v in verts]
    if part['skin']:
        inf,weights,local_binds=skin_data(part['skin'])
        corrections={i:C@binds[bone]@local_binds[bone].inverted_safe()@transform for i,bone in inf.items() if bone in binds and bone in local_binds}
        for vi,row in weights.items():
            if vi>=len(verts):continue
            total=sum(w for i,w in row if i in corrections)
            if total>0:
                coords[vi]=sum(((corrections[i]@Vector(verts[vi]))*(w/total) for i,w in row if i in corrections),Vector((0,0,0)))
    mesh=bpy.data.meshes.new(parent);mesh.from_pydata(coords,[],faces);mesh.update()
    ob=bpy.data.objects.new(parent,mesh)
    col='02_CLOTHING' if parent.startswith('xizhuang') else '03_XGEN_GUIDES_NOT_FINAL_HAIR' if parent in ['Head_HairModel','Mm','UP','Down'] else '01_BODY' if parent in ['Body_Model','Eye_R_Model','Eye_L_Model','Eye_Bai_R_Model','Eye_Bai_L_Model','LeiXian_Model','kouqiang_up','kouqiang_down','shetou'] else '04_ACCESSORIES'
    cols[col].objects.link(ob);mesh.materials.append(mat_for(live))
    if uvs:
        uv=mesh.uv_layers.new(name='UVMap')
        for poly,ids in zip(mesh.polygons,faceuv):
            if len(ids)==poly.loop_total:
                for li,ui in zip(poly.loop_indices,ids):uv.data[li].uv=uvs[ui]
    for p in mesh.polygons:p.use_smooth=True
    covered=0
    if part['skin']:
        influences,weights,_=skin_data(part['skin'])
        groups={i:ob.vertex_groups.new(name=n) for i,n in influences.items() if n in binds}
        for vi,row in weights.items():
            if vi>=len(verts):continue
            total=sum(w for i,w in row if i in groups)
            if total>0:
                covered+=1
                for i,w in row:
                    if i in groups and w>0:groups[i].add([vi],w/total,'REPLACE')
        mod=ob.modifiers.new('Imported native skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
    mod=ob.modifiers.new('Preview smoothing','SUBSURF');mod.levels=1;mod.render_levels=1
    ob.parent=rig
    report['meshes'][parent]={'vertices':len(verts),'faces':len(faces),'skin':part['skin'],'weighted_vertices':covered,'material':mesh.materials[0].name}

# Preserve guide curves exactly; they are not the final generated XGen hair.
curve=bpy.data.curves.new('Source XGen guides','CURVE');curve.dimensions='3D';curve.bevel_depth=.0006;curve.bevel_resolution=1
for name,n in nodes.items():
    if n['type']!='xgmMakeGuide':continue
    data=attr(name,'.cgm')
    if not data:continue
    count=int(data[0]);points=data[1:];assert len(points)==count*4
    spl=curve.splines.new('POLY');spl.points.add(count-1)
    for i,p in enumerate(spl.points):p.co=(*tuple(C@Vector(points[i*4:i*4+3])),1)
guide=bpy.data.objects.new('XGEN_GUIDES_ONLY',curve);cols['03_XGEN_GUIDES_NOT_FINAL_HAIR'].objects.link(guide)
guide.hide_render=True
report['xgen_guides']=len(curve.splines);report['bones']=len(arm.bones)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=900;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(.15,.15,.15)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
camd=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',camd);cols['90_STAGE'].objects.link(cam);cam.location=(.5,-3.5,1.6);aim(cam,(0,0,1.05));camd.type='ORTHO';camd.ortho_scale=2.15;scene.camera=cam
for name,loc,energy,size in [('Key',(-2,-3,3),350,3),('Fill',(2,-1,2),180,2),('Rim',(0,2,3),250,2)]:
    ld=bpy.data.lights.new(name,'AREA');ld.energy=energy;ld.shape='DISK';ld.size=size;o=bpy.data.objects.new(name,ld);cols['90_STAGE'].objects.link(o);o.location=loc;aim(o,(0,0,1.2))
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'previews/xuniren_source_front.png')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.overlay.show_overlays=False
bpy.ops.object.select_all(action='DESELECT');bpy.context.view_layer.objects.active=bpy.data.objects.get('Body_Model')
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'xuniren_import_v01.blend'))
(OUT/'import-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
bpy.ops.render.render(write_still=True)
print('IMPORT_DONE',json.dumps(report))
