import { Image as ImageIcon } from 'lucide-react';
import { ImageTray } from '../components/Inputs';
import { ModelPicker } from '../components/ModelPicker';
import { ParamGroup } from '../components/ParamControls';
import { PromptBox } from '../components/PromptBox';
import { useApp } from '../store/app';
import { EmptyState, GenerateBar, IMAGE_ENHANCERS, StudioLayout, useIncomingInput } from './common';
import { buildAttachments, cleanParams, splitParams, useEngine, validate, type EngineConfig } from './useEngine';

const CFG: EngineConfig = { key: 'image', studio: 'image', kind: 'image', textCats: ['t2i'], mediaCats: ['i2i', 'enhance'] };

const IDEAS = [
  'A lighthouse on a cliff during a violent storm, oil painting',
  'Editorial portrait of an elderly fisherman, Rembrandt light',
  'Isometric cozy bookstore at night, warm neon sign',
  'Product shot of a glass perfume bottle on wet black stone',
];

export function ImageStudio() {
  const e = useEngine(CFG);
  const generate = useApp((s) => s.generate);
  useIncomingInput((d) => d.kind === 'image' && e.addImages([d.uploadId]));

  const reason = validate(e.model, { prompt: e.prompt, images: e.imageIds.length, values: e.values });
  const { primary, advanced } = e.model ? splitParams(e.model.params) : { primary: [], advanced: [] };
  const submit = () => {
    if (reason || !e.model) return;
    generate({
      studio: 'image',
      model: e.model,
      kind: 'image',
      prompt: e.prompt,
      params: cleanParams(e.model, e.values),
      attachments: buildAttachments(e.model, { images: e.imageIds }),
    });
  };

  const media = e.mode === 'media';
  return (
    <StudioLayout
      studio="image"
      title="Image Studio"
      mode={{ label: media ? (e.imageIds.length > 1 ? `Edit · ${e.imageIds.length} images` : 'Edit mode') : 'Text to image', media }}
      panel={
        <>
          <ImageTray
            ids={e.imageIds}
            max={14}
            onAdd={e.addImages}
            onRemove={e.removeImage}
            onMove={e.moveImage}
            title="Input images"
            hint="Optional: add one or more images to edit, restyle or combine them"
          />
          <PromptBox
            value={e.prompt}
            onChange={e.setPrompt}
            onSubmit={submit}
            enhancers={IMAGE_ENHANCERS}
            optional={!e.model?.inputs.prompt?.required}
            placeholder={media ? 'Describe the edit, e.g. “make it golden hour and add falling snow”. Refer to images as @1, @2…' : 'Describe the image you want to create…'}
          />
          <div className="section">
            <div className="label">Model</div>
            <ModelPicker models={e.candidates} value={e.model} onChange={e.setModel} hiddenCount={e.hiddenCount} modeLabel={media ? 'image input' : 'text'} />
          </div>
          {e.model && <ParamGroup primary={primary} advanced={advanced} values={e.values} onChange={e.setValue} onReset={e.resetValues} />}
          <GenerateBar onClick={submit} reason={reason} model={e.model} />
        </>
      }
      empty={
        <EmptyState
          icon={<ImageIcon size={32} color="white" />}
          title="Create or edit images"
          text="Type a prompt to generate. Drop in images and the studio automatically switches to edit and multi-reference models."
          ideas={IDEAS}
          onIdea={e.setPrompt}
        />
      }
    />
  );
}
