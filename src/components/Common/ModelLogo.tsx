import { MachineLearningModel } from '@carbon/icons-react';
import { modelBrand, type ModelBrand } from '@utils/model-brand';
import openai from '../../assets/model-logos/openai.svg';
import claude from '../../assets/model-logos/claude.svg';
import gemini from '../../assets/model-logos/gemini.svg';
import deepseek from '../../assets/model-logos/deepseek.svg';
import meta from '../../assets/model-logos/meta.svg';
import mistral from '../../assets/model-logos/mistral.svg';
import qwen from '../../assets/model-logos/qwen.svg';
import grok from '../../assets/model-logos/grok.svg';
import openrouter from '../../assets/model-logos/openrouter.svg';
import './model-logo.css';

const logos: Record<ModelBrand, string> = { openai, claude, gemini, deepseek, meta, mistral, qwen, grok, openrouter };

export default function ModelLogo({ model }: { model?: string }) {
  const brand = modelBrand(model);
  if (!brand) return <MachineLearningModel size={16} className="model-logo" aria-hidden="true" />;
  const mask = `url("${logos[brand]}")`;
  return <span className="model-logo model-logo-brand" data-model-brand={brand} aria-hidden="true"
    style={{ maskImage: mask, WebkitMaskImage: mask }} />;
}
