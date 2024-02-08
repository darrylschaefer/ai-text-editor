import { FineTuneModel } from '@type/config';

const date = new Date();
const dateString =
  date.getFullYear() +
  '-' +
  ('0' + (date.getMonth() + 1)).slice(-2) +
  '-' +
  ('0' + date.getDate()).slice(-2);

export const generateDefaultFineTuneModel = (): FineTuneModel => {
    return {
        name: 'Default',
        model: 'ft:gpt-3.5-turbo:my-org:custom_suffix:id',
    };
}