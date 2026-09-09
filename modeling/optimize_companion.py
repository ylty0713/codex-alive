import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'assets/companion/character.glb'))
for image in bpy.data.images:
    if image.size[0]>1024 or image.size[1]>1024:
        factor=1024/max(image.size)
        image.scale(max(1,round(image.size[0]*factor)),max(1,round(image.size[1]*factor)))
for ob in bpy.data.objects:
    if ob.type=='MESH' and ob.data.shape_keys:
        keys=list(ob.data.shape_keys.key_blocks)
        # Preserve original ARKit 52 expressions, remove extended duplicate shapes only in runtime copy.
        for key in keys[53:]:ob.shape_key_remove(key)
bpy.ops.export_scene.gltf(filepath=str(root/'assets/companion/character-runtime.glb'),export_format='GLB',export_animations=False)
print('RUNTIME_MODEL_READY')
