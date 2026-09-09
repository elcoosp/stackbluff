import { useForm } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export const RaiseSlider = ({
  min,
  max,
  step,
  pot,
  onConfirm,
}: {
  min: number;
  max: number;
  step: number;
  pot: number;
  onConfirm: (amount: number) => void;
}) => {
  const form = useForm({
    defaultValues: { amount: min },
    onSubmit: ({ value }) => onConfirm(value.amount),
  });
  return (
    <form.Field
      name="amount"
      validators={{ onChange: ({ value }) => value >= min && value <= max }}
      children={(field) => (
        <div className="space-y-4 p-4 bg-surface-container rounded-xl border border-outline-variant/20">
          <Slider
            value={[field.state.value]}
            min={min}
            max={max}
            step={step}
            onValueChange={(vals) => field.handleChange(vals[0])}
            className="w-full"
          />
          <div className="flex gap-2">
            <Button onClick={() => field.handleChange(Math.floor(pot * 0.5))}>½ POT</Button>
            <Button onClick={() => field.handleChange(Math.floor(pot * 0.75))}>¾ POT</Button>
            <Button onClick={() => field.handleChange(pot)}>POT</Button>
            <Button onClick={() => field.handleChange(max)}>MAX</Button>
          </div>
          <Button
            className="w-full bg-tertiary text-on-tertiary"
            onClick={() => form.handleSubmit()}
          >
            Confirm Raise
          </Button>
        </div>
      )}
    />
  );
};
