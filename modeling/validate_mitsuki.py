"""Reopen and check the imported source, including actual skin deformation."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/mitsuki'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'mitsuki_source_v01.blend'))
rig=bpy.data.objects['Mitsuki_Rig']
meshes={n:bpy.data.objects['Mitsuki_'+n] for n in ['Body','Eyes','Mouth','Eyelashes']}
for ob in meshes.values():
    for mod in ob.modifiers:
        if mod.type=='SUBSURF':mod.show_viewport=False

def positions(obj):
    bpy.context.view_layer.update()
    dep=bpy.context.evaluated_depsgraph_get()
    ev=obj.evaluated_get(dep)
    return [v.co.copy() for v in ev.data.vertices]

report={'bones':len(rig.data.bones),'rest':{},'pose':{},'packed_images':0}
rest={}
for name,ob in meshes.items():
    expected=[v.co.copy() for v in ob.data.vertices]
    basis=ob.data.shape_keys.key_blocks[0]
    for key in list(ob.data.shape_keys.key_blocks)[1:]:
        for i,v in enumerate(key.data):expected[i]+=(v.co-basis.data[i].co)*key.value
    actual=positions(ob);rest[name]=actual
    error=max((a-b).length for a,b in zip(actual,expected))
    assert error<1e-5,(name,error)
    assert len(ob.data.uv_layers.active.data)==len(ob.data.loops)
    report['rest'][name]={'max_position_error_m':error,'vertices':len(actual)}

for bone in ['head','l_upperarm']:
    pb=rig.pose.bones[bone];pb.rotation_mode='XYZ';pb.rotation_euler.z=math.radians(15)
    moved=positions(meshes['Body'])
    distances=[(a-b).length for a,b in zip(moved,rest['Body'])]
    assert all(math.isfinite(x) for x in distances)
    assert max(distances)>.001
    feet=[i for i,p in enumerate(rest['Body']) if p.z<.15]
    descendants={bone}|{b.name for b in rig.data.bones[bone].children_recursive}
    unaffected=[v.index for v in meshes['Body'].data.vertices if not any(meshes['Body'].vertex_groups[g.group].name in descendants and g.weight>0 for g in v.groups)]
    assert max(distances[i] for i in unaffected)<1e-5
    report['pose'][bone]={'max_movement_m':max(distances),'unweighted_vertices_stationary':True,'max_foot_movement_m':max(distances[i] for i in feet)}
    if bone=='head':
        eye_move=max((a-b).length for a,b in zip(positions(meshes['Eyes']),rest['Eyes']))
        assert eye_move>.001
        report['pose'][bone]['eyes_follow_head_m']=eye_move
    pb.rotation_euler=(0,0,0)

for image in bpy.data.images:
    if image.source=='FILE' and image.filepath:
        assert image.packed_file is not None,image.name
        report['packed_images']+=1
report['passed']=True
report['source_weight_note']='Native source contains small upper-arm weights on some foot vertices; 15-degree arm test moves one foot vertex about 0.4 mm. Preserved for source fidelity; clean before production animation.'
(OUT/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
