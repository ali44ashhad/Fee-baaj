import type { ISettingSaveRequest, ISettingSaveResponse, IErrorResponse, ISettingResponse } from "@elearning/types"
import { useMutation } from "@tanstack/react-query"
import categoryServices from "../services"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { SettingSaveSchema } from "@elearning/schemas"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import DiscountExpirationSelector from "./DiscountExpirationSelector"

interface EditSettingFormProps {
  setting: ISettingResponse
}

export default function EditSettingForm({ setting }: EditSettingFormProps) {
  const { mutate, isPending } = useMutation<ISettingSaveResponse, IErrorResponse, ISettingSaveRequest>({
    mutationFn: categoryServices.update,
  })

  const onSubmit = (values: ISettingSaveRequest) => {
    mutate(values)
  }

  const form = useForm<ISettingSaveRequest>({
    resolver: zodResolver(SettingSaveSchema),
    defaultValues: {
      discountValidUntil: setting.discountValidUntil ? new Date(setting.discountValidUntil) : undefined,
    },
  })

  const { register, setValue, watch, handleSubmit, control } = form

  const { errors } = form.formState

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card className="my-5">
        <CardHeader>
          <CardTitle>Discount</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Controller
            control={control}
            name="discountValidUntil"
            render={({ field }) => (
              <DiscountExpirationSelector
                value={field.value}
                onChange={field.onChange}
                error={errors?.discountValidUntil?.message}
              />
            )}
          />
        </CardContent>
      </Card>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Saving..." : "Save"}
      </Button>
    </form>
  )
}

