"""Import locally owned G9/Mitsuki base DSF data; Blender background script.

Preserves base topology, UV seams, native vertex weights and editable morphs.
This is a base-resolution conversion, not an Iray/DHDM/ERC implementation.
"""
import bpy, json, gzip, math
from pathlib import Path
from urllib.parse import unquote
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT/'assets/source-models/genesis9-starter/Content'
MITS = ROOT/'assets/source-models/daz104141/unpacked/Content'
OUT = ROOT/'assets/mitsuki'
OUT.mkdir(exist_ok=True)
PRE = ROOT/'previews'

def read(path):
    b=path.read_bytes()
    return json.loads(gzip.decompress(b) if b[:2]==b'\x1f\x8b' else b)

def resolve(url):
    rel=unquote(url.split('#')[0]).lstrip('/')
    for root in [MITS, BASE]:
        p=root/rel
        if p.is_file(): return p
    raise FileNotFoundError(rel)

def xyz(v): return Vector((v[0]*.01,-v[2]*.01,v[1]*.01))
def channels(v): return [c['value'] for c in v]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
collections={}
for name in ['01_CHARACTER','10_WARDROBE','90_STAGE']:
    c=bpy.data.collections.new(name);scene.collection.children.link(c);collections[name]=c

def link(obj,col='01_CHARACTER'):
    collections[col].objects.link(obj)

specs=[('Body','Base','Genesis9.dsf'),('Eyes','Genesis 9 Eyes','Genesis9Eyes.dsf'),
       ('Mouth','Genesis 9 Mouth','Genesis9Mouth.dsf'),('Eyelashes','Genesis 9 Eyelashes','Genesis9Eyelashes.dsf')]
docs={}; morphs={}; nodes={}
for name,folder,file in specs:
    docs[name]=read(BASE/'data/Daz 3D/Genesis 9'/folder/file)
    morphdir=MITS/'data/Daz 3D/Genesis 9'/folder/'Morphs/Noki/Noki Mitsuki'
    morphs[name]=[read(p)['modifier_library'][0] for p in sorted(morphdir.glob('*.dsf')) if p.stem in ['Mitsuki Head','Mitsuki Body']]
    for n in docs[name]['node_library']:
        if n['type']=='bone' and n['id'] not in nodes: nodes[n['id']]=n

# The saved character preset contains the final fitted bone positions.
preset=read(MITS/'People/Genesis 9/Characters/Mitsuki.duf')
fitted={unquote(n['url'].split('#')[-1]):n['preview'] for n in preset['scene']['nodes'] if 'preview' in n and 'url' in n}
# Additional mouth bones have no body-preset preview; evaluate the simple rest offsets.
offsets={}
for ms in morphs.values():
    for m in ms:
        for f in m.get('formulas',[]):
            output=unquote(f['output']); prop=output.split('?')[-1]
            if prop.split('/')[0] not in ['center_point','end_point']: continue
            ops=f['operations']
            if len(ops)==3 and ops[-1]['op']=='mult' and 'val' in ops[1]:
                offsets[(output.split(':')[0],prop)]=ops[1]['val']

arm=bpy.data.armatures.new('G9_Mitsuki_Skeleton')
rig=bpy.data.objects.new('Mitsuki_Rig',arm);link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,n in nodes.items():
    b=arm.edit_bones.new(name)
    pts=[]
    for prop in ['center_point','end_point']:
        if name in fitted: p=fitted[name][prop]
        else: p=[v+offsets.get((name,prop+'/'+axis),0) for axis,v in zip('xyz',channels(n[prop]))]
        pts.append(xyz(p))
    b.head,b.tail=pts
    if (b.tail-b.head).length<.0001: b.tail=b.head+Vector((0,0,.005))
for name,n in nodes.items():
    parent=n.get('parent','').split('#')[-1]
    if parent in arm.edit_bones: arm.edit_bones[name].parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True
rig['conversion_notes']='Native vertex weights; fitted rest skeleton; DAZ ERC/JCM drivers and DHDM not implemented.'

def plain(name,color):
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*color,1);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=.6
    return mat

def texture(mat,path,socket,normal=False):
    if not path:return
    im=bpy.data.images.load(str(resolve(path)),check_existing=True)
    if normal or socket=='Alpha':im.colorspace_settings.name='Non-Color'
    node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=im
    bs=mat.node_tree.nodes.get('Principled BSDF')
    if normal:
        nm=mat.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.35
        mat.node_tree.links.new(node.outputs['Color'],nm.inputs['Color'])
        mat.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    else:mat.node_tree.links.new(node.outputs['Color'],bs.inputs[socket])

skinmats={}
for sm in preset['scene']['materials']:
    for group in sm['groups']:
        mat=plain('Mitsuki | '+group,(.65,.42,.34))
        texture(mat,sm.get('diffuse',{}).get('channel',{}).get('image_file'),'Base Color')
        for ex in sm.get('extra',[]):
            for item in ex.get('channels',[]):
                c=item['channel']
                if c['id']=='Detail Normal Map' and c.get('image_file'):texture(mat,c['image_file'],'Normal',True)
        skinmats[group]=mat

eyemat=plain('Mitsuki | daily blue eyes',(.3,.13,.08))
texture(eyemat,'/Runtime/Textures/Noki/Noki Mitsuki/Mitsuki - Eyes2.png','Base Color')
eyemat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.2
moist=plain('Eye moisture | transparent shell',(1,1,1))
nt=moist.node_tree;nt.nodes.clear();trans=nt.nodes.new('ShaderNodeBsdfTransparent');out=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(trans.outputs[0],out.inputs[0])
lashmat=plain('Mitsuki | eyelashes',(.018,.012,.01))
texture(lashmat,'/Runtime/Textures/DAZ/Characters/Genesis9/Base/Eyelashes/Genesis9_Eyelashes01_C.jpg','Alpha')
mouthmat=plain('Mitsuki | mouth',(.5,.12,.12))
texture(mouthmat,'/Runtime/Textures/DAZ/Characters/Genesis9/Base/Genesis9_Mouth_D_1001.jpg','Base Color')

objects={};report={'meshes':{},'limitations':['Base-resolution Mitsuki deltas only; DHDM HD details omitted.','Iray shaders approximated with Principled BSDF.','DAZ ERC, JCM drivers and rotation conventions are not translated; this is an editable source import, not an animation-ready final Rin.','Hair and academy outfit still require fitting and anime art direction.']}
for name,folder,file in specs:
    d=docs[name];g=d['geometry_library'][0];raw=g['vertices']['values'];faces=g['polylist']['values']
    mesh=bpy.data.meshes.new('Mitsuki_'+name);mesh.from_pydata([xyz(v) for v in raw],[],[f[2:] for f in faces]);mesh.update()
    obj=bpy.data.objects.new('Mitsuki_'+name,mesh);link(obj);objects[name]=obj
    obj.shape_key_add(name='Genesis9 Basis')
    for morph in morphs[name]:
        key=obj.shape_key_add(name=morph['name']);key.value=1
        for i,x,y,z in morph['morph']['deltas']['values']:
            assert 0<=i<len(raw)
            key.data[i].co += xyz((x,y,z))
    uvdoc=read(resolve(g['default_uv_set']))['uv_set_library'][0]
    uvs=uvdoc['uvs']['values'];overrides={(p,v):u for p,v,u in uvdoc.get('polygon_vertex_indices',[])}
    layer=mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        poly.material_index=faces[poly.index][1];poly.use_smooth=True
        # Body UDIM tiles use separate materials; shift each polygon tile to 0..1.
        uvcoords=[uvs[overrides.get((poly.index,mesh.loops[li].vertex_index),mesh.loops[li].vertex_index)] for li in poly.loop_indices]
        tile=math.floor(sum(uv[0] for uv in uvcoords)/len(uvcoords)) if name=='Body' else 0
        for li,uv in zip(poly.loop_indices,uvcoords):layer.data[li].uv=(uv[0]-tile,uv[1])
    for group in g['polygon_material_groups']['values']:
        mat=skinmats[group] if name=='Body' else (moist if 'Moisture' in group else eyemat) if name=='Eyes' else lashmat if name=='Eyelashes' else mouthmat
        mesh.materials.append(mat)
    skin=next(m['skin'] for m in d['modifier_library'] if 'skin' in m)
    sums=[0.0]*len(raw)
    for j in skin['joints']:
        bone=j['node'].split('#')[-1];assert bone in arm.bones,bone
        vg=obj.vertex_groups.new(name=bone)
        for i,w in j.get('node_weights',{}).get('values',[]):
            vg.add([i],w,'REPLACE');sums[i]+=w
    assert min(sums)>.99,(name,min(sums))
    mod=obj.modifiers.new('Native G9 skin weights','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
    sub=obj.modifiers.new('Preview subdivision','SUBSURF');sub.levels=1;sub.render_levels=2
    obj.parent=rig
    report['meshes'][name]={'vertices':len(raw),'polygons':len(faces),'weight_sum_min':min(sums),'weight_sum_max':max(sums),'morphs':[m['name'] for m in morphs[name]],'uv_seam_overrides':len(overrides)}

# Opaque fitting garment, separate object/collection. It is deliberately labeled
# as a fitting cover rather than the finished academy clothing.
body=objects['Body']
coords=[v.co.copy() for v in body.data.vertices]
for key in list(body.data.shape_keys.key_blocks)[1:]:
    for i,v in enumerate(key.data):coords[i]+=v.co-body.data.vertices[i].co
selected=[]
for p in body.data.polygons:
    z=sum(coords[i].z for i in p.vertices)/len(p.vertices)
    x=sum(abs(coords[i].x) for i in p.vertices)/len(p.vertices)
    if .91<z<1.39 and x<.255:selected.append(tuple(p.vertices))
used=sorted({i for f in selected for i in f});mapping={v:i for i,v in enumerate(used)}
covermesh=bpy.data.meshes.new('FittingCover');covermesh.from_pydata([coords[i]+body.data.vertices[i].normal*.006 for i in used],[],[[mapping[i] for i in f] for f in selected]);covermesh.update()
cover=bpy.data.objects.new('FITTING_ONLY_Separate_Cover',covermesh);link(cover,'10_WARDROBE')
covermesh.materials.append(plain('Fitting cover | navy',(.025,.04,.075)))
for p in covermesh.polygons:p.use_smooth=True
for group in body.vertex_groups:cover.vertex_groups.new(name=group.name)
for old,new in mapping.items():
    for g in body.data.vertices[old].groups:cover.vertex_groups[g.group].add([new],g.weight,'REPLACE')
mod=cover.modifiers.new('Shared skeleton','ARMATURE');mod.object=rig
mod=cover.modifiers.new('Smooth fitting cover','SUBSURF');mod.levels=1
mod=cover.modifiers.new('Fabric thickness','SOLIDIFY');mod.thickness=.003
cover.parent=rig

def aim(obj,pt):obj.rotation_euler=(Vector(pt)-obj.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('PortraitCamera');cam=bpy.data.objects.new('PortraitCamera',camdata);link(cam,'90_STAGE');scene.camera=cam
headpos=arm.bones['head'].head_local
target=(0,-.015,headpos.z+.015)
cam.location=(.34,-1.65,target[2]+.045);camdata.type='ORTHO';camdata.ortho_scale=.37;aim(cam,target)
for name,loc,power,size in [('Key',(-1,-2,2.7),180,2),('Fill',(1,-1,1.7),80,2),('Rim',(0,1,2.3),140,1.5)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);link(ob,'90_STAGE');ob.location=loc;aim(ob,target)
scene.world.color=(.18,.18,.18)
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(PRE/'mitsuki_import_portrait.png')
report['bones']=len(arm.bones);report['textures']=len(bpy.data.images)
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=2.5
            area.spaces.active.region_3d.view_location=(0,0,.95)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mitsuki_source_v01.blend'))
(OUT/'import-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
bpy.ops.render.render(write_still=True)
print('IMPORT_COMPLETE',json.dumps(report))
