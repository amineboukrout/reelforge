import { Video } from 'lucide-react';
import { ImageTray, MediaSlot } from '../components/Inputs';
import { ModelPicker } from '../components/ModelPicker';
import { ParamGroup } from '../components/ParamControls';
import { PromptBox } from '../components/PromptBox';
import { useApp } from '../store/app';
import { EmptyState, GenerateBar, StudioLayout, VIDEO_ENHANCERS, useIncomingInput } from './common';
import { buildAttachments, cleanParams, splitParams, useEngine, validate, type EngineConfig } from './useEngine';

const CFG: EngineConfig = { key: 'video', studio: 'video', kind: 'video', textCats: ['t2v'], mediaCats: ['i2v'] };

const IDEAS = [
  'A paper boat drifting down a rain-soaked city gutter, macro',
  'Astronaut walking through a field of glowing jellyfish flowers',
  'Slow-motion splash of coffee forming a crown, studio light',
  'Drone shot over misty pine forest at sunrise',
];

export function VideoStudio() {
  const e = useEngine(CFG);
  const generate = useApp((s) => s.generate);
  useIncomingInput((d) => d.kind === 'image' && e.addImages([d.uploadId]));

  const endField = e.model?.inputs.endImage;
  const reason = validate(e.model, { prompt: e.prompt, images: e.imageIds.length, endImage: !!e.endImageId, values: e.values });
  const { primary, advanced } = e.model ? splitParams(e.model.params) : { primary: [], advanced: [] };
  const submit = () => {
    if (reason || !e.model) return;
    generate({
      studio: 'video',
      model: e.model,
      kind: 'video',
      prompt: e.prompt,
      params: cleanParams(e.model, e.values),
      attachments: buildAttachments(e.model, { images: e.imageIds, endImage: endField ? e.endImageId : null }),
    });
  };

  const media = e.mode === 'media';
  const multi = e.imageIds.length > 1;
  return (
    <StudioLayout
      studio="video"
      title="Video Studio"
      mode={{ label: media ? (multi ? `Reference · ${e.imageIds.length} images` : 'Image to video') : 'Text to video', media }}
      panel={
        <>
          <ImageTray
            ids={e.imageIds}
            max={14}
            onAdd={e.addImages}
            onRemove={e.removeImage}
            onMove={e.moveImage}
            title={multi ? 'Reference images' : 'Start frame'}
            hint="Optional: animate an image, or add several for reference-to-video models"
          />
          {media && endField && (
            <MediaSlot title="End frame" kinds={['image']} id={e.endImageId} onChange={e.setEndImage} optional={!endField.required} hint="The shot will transition into this frame" />
          )}
          <PromptBox
            value={e.prompt}
            onChange={e.setPrompt}
            onSubmit={submit}
            enhancers={VIDEO_ENHANCERS}
            optional={!e.model?.inputs.prompt?.required}
            placeholder={media ? 'Describe the motion: what moves, how the camera behaves…' : 'Describe the shot: subject, action, setting, camera…'}
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
          icon={<Video size={32} color="white" />}
          title="Make a video"
          text="Start from text, or drop in a start frame to animate it. Models switch automatically based on what you add."
          ideas={IDEAS}
          onIdea={e.setPrompt}
        />
      }
    />
  );
}
