'use client';
import { useEffect, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { CartItem } from '@/lib/types';

interface ModifyValue {
  code?: string;
  name?: string;
  selectedKey?: string;
  unselectedKey?: string;
  selectedQuantity?: number;
  minQuantity?: number;
  maxQuantity?: number;
  price?: number;
}
interface Modification {
  items?: { minValues?: number; maxValues?: number; values?: ModifyValue[] }[];
}
interface Choice {
  code: string;
  name?: string;
  isDefault?: number;
  quantity?: number;
  maxQuantity?: number;
  supportModify?: boolean;
  diffPrice?: string;
  modification?: Modification;
}
interface Round {
  id?: number;
  name?: string;
  minQuantity?: number;
  maxQuantity?: number;
  choices?: Choice[];
}
interface Detail {
  code?: string;
  name?: string;
  supportModify?: boolean;
  rounds?: Round[];
  modification?: Modification;
}
function defaultMods(mod?: Modification): Record<string, number> {
  const result: Record<string, number> = {};
  for (const group of mod?.items || [])
    for (const value of group.values || [])
      result[String(value.code)] = value.selectedQuantity || 0;
  return result;
}
function encodedMods(mod: Modification | undefined, quantities: Record<string, number>) {
  return {
    values: (mod?.items || []).flatMap((group) =>
      (group.values || []).flatMap((value) => {
        const quantity = quantities[String(value.code)] || 0;
        const key = quantity > 0 ? value.selectedKey : value.unselectedKey;
        return key ? [{ code: value.code, key, quantity }] : [];
      }),
    ),
  };
}

function ModificationFields({
  mod,
  value,
  onChange,
}: {
  mod: Modification;
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  return (
    <div className="customizer-modifications">
      {mod.items?.map((group, index) => (
        <div className="modification-group" key={index}>
          {group.values?.map((option) => (
            <label key={option.code}>
              <span>{option.name || option.code}</span>
              <input
                aria-label={`${option.name || '特调'}数量`}
                type="number"
                min={0}
                max={option.maxQuantity || 10}
                step={1}
                value={value[String(option.code)] || 0}
                onChange={(event) =>
                  onChange({ ...value, [String(option.code)]: Number(event.target.value) })
                }
              />
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

export function MealCustomizer({
  detail: raw,
  onSave,
}: {
  detail: unknown;
  onSave: (item: CartItem) => void;
}) {
  const detail = raw as Detail;
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [mods, setMods] = useState<Record<string, Record<string, number>>>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const selected: Record<string, number> = {},
      modValues: Record<string, Record<string, number>> = {
        root: defaultMods(detail.modification),
      };
    for (const round of detail.rounds || [])
      for (const choice of round.choices || []) {
        selected[`${round.id}:${choice.code}`] = choice.isDefault === 1 ? choice.quantity || 1 : 0;
        modValues[choice.code] = defaultMods(choice.modification);
      }
    setChoices(selected);
    setMods(modValues);
    setSaved(false);
  }, [raw]);
  function save() {
    setError('');
    for (const round of detail.rounds || []) {
      const total = (round.choices || []).reduce(
        (sum, choice) => sum + (choices[`${round.id}:${choice.code}`] || 0),
        0,
      );
      if (total < (round.minQuantity || 0) || total > (round.maxQuantity || Infinity)) {
        setError(
          `${round.name || '选配轮次'}需选择 ${round.minQuantity || 0}–${round.maxQuantity || '不限'} 份，请调整数量。`,
        );
        return;
      }
    }
    const item: CartItem = { productCode: String(detail.code), quantity: 1 };
    if (detail.modification) item.modification = encodedMods(detail.modification, mods.root || {});
    if (detail.rounds?.length)
      item.roundList = detail.rounds.map((round) => ({
        round: String(round.id),
        comboItemList: (round.choices || [])
          .filter((choice) => (choices[`${round.id}:${choice.code}`] || 0) > 0)
          .map((choice) => ({
            code: choice.code,
            quantity: choices[`${round.id}:${choice.code}`],
            ...(choice.modification
              ? { modification: encodedMods(choice.modification, mods[choice.code] || {}) }
              : {}),
          })),
      }));
    onSave(item);
    setSaved(true);
  }
  const defaults = (detail.rounds || []).flatMap((round) =>
    (round.choices || [])
      .filter((choice) => choice.isDefault === 1)
      .map((choice) => choice.name || choice.code),
  );
  return (
    <section className="meal-customizer">
      <div className="section-heading">
        <h3>
          {detail.name || '餐品详情'}
          {detail.supportModify ? '【可特调】' : ''}
        </h3>
        <span className="source-label">由门店详情提供</span>
      </div>
      {defaults.length > 0 && (
        <p className="customizer-defaults">默认搭配：{defaults.join(' + ')}</p>
      )}
      {detail.rounds?.map((round) => (
        <fieldset className="customizer-round" key={round.id}>
          <legend>{round.name || '套餐选配'}</legend>
          <small>
            请选择 {round.minQuantity || 0}–{round.maxQuantity || '不限'} 份
          </small>
          {round.choices?.map((choice) => (
            <div className="customizer-choice" key={choice.code}>
              <label>
                <span>
                  {choice.name || choice.code}
                  {choice.supportModify ? '【可特调】' : ''}
                  {choice.isDefault === 1 && <small>默认</small>}
                </span>
                <input
                  type="number"
                  aria-label={`${choice.name}数量`}
                  min={0}
                  max={choice.maxQuantity || round.maxQuantity || 10}
                  step={1}
                  value={choices[`${round.id}:${choice.code}`] || 0}
                  onChange={(event) => {
                    setChoices({
                      ...choices,
                      [`${round.id}:${choice.code}`]: Number(event.target.value),
                    });
                    setSaved(false);
                  }}
                />
              </label>
              {choice.modification && (
                <details className="advanced-fields">
                  <summary>
                    查看特调 <ChevronDown size={13} />
                  </summary>
                  <ModificationFields
                    mod={choice.modification}
                    value={mods[choice.code] || {}}
                    onChange={(next) => {
                      setMods({ ...mods, [choice.code]: next });
                      setSaved(false);
                    }}
                  />
                </details>
              )}
            </div>
          ))}
        </fieldset>
      ))}
      {detail.modification && (
        <details className="advanced-fields">
          <summary>
            查看特调 <ChevronDown size={13} />
          </summary>
          <ModificationFields
            mod={detail.modification}
            value={mods.root || {}}
            onChange={(next) => {
              setMods({ ...mods, root: next });
              setSaved(false);
            }}
          />
        </details>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <p className="customizer-notice">套餐子项和特调会带入验价。特调后的营养暂不计算。</p>
      <button className="button button-small button-orange" onClick={save}>
        {saved ? <Check size={15} /> : null}
        {saved ? '已加入待验价组合' : '保存这份搭配并验价'}
      </button>
    </section>
  );
}
