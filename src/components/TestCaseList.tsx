import { AlertCircle, Check, Clock, Play, Trash } from "lucide-react"
import React from "react"

import { cn } from "../lib/utils"
import type { TestCase } from "../types"
import { Button } from "./ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "./ui/card"
import { Typography } from "./ui/typography"

export interface TestCaseListProps {
  tests: TestCase[]
  onTestUpdate: (updatedTest: TestCase) => void
  onRunTests: (selectedTests: TestCase[]) => void
  clearResults: () => void
}

export const TestCaseList: React.FC<TestCaseListProps> = ({
  tests,
  onTestUpdate,
  onRunTests,
  clearResults
}) => {
  const handleTestToggle = (test: TestCase) => {
    onTestUpdate({
      ...test,
      enabled: !test.enabled
    })
  }

  const handleRunSelectedTests = () => {
    const selectedTests = tests.filter((test) => test.enabled)
    onRunTests(selectedTests)
  }

  const getStatusIcon = (status: TestCase["status"]) => {
    switch (status) {
      case "success":
        return <Check className="h-5 w-5 text-green-500" />
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case "running":
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return null
    }
  }

  const selectedTests = tests.filter((test) => test.enabled)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <Typography variant="h4">Available Tests</Typography>
        <div className="flex gap-2">
          <Button
            onClick={handleRunSelectedTests}
            variant="primary"
            disabled={selectedTests.length === 0}
            className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Run Tests
          </Button>
          <Button onClick={clearResults} variant="danger">
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {tests.map((test, index) => (
          <Card
            key={`card-${index}`}
            className={cn(
              "relative cursor-pointer transition-all",
              test.enabled && "ring-2 ring-blue-400 bg-blue-50",
              test.status === "success" && "bg-green-50",
              test.status === "failed" && "bg-red-50",
              test.status === "running" && "bg-blue-50"
            )}
            onClick={() => handleTestToggle(test)}>
            <div className="absolute top-4 right-4">
              {getStatusIcon(test.status)}
            </div>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={test.enabled}
                  onChange={(e) => {
                    // Stop propagation to prevent double toggle
                    e.stopPropagation();
                    handleTestToggle(test);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-400 focus:ring-blue-400"
                />
                <div>
                  <CardTitle>{test.name}</CardTitle>
                  <CardDescription>{test.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            {test.result && (
              <CardContent>
                <div className="text-sm">
                  {test.result.success ? (
                    <span className="text-green-600">
                      Test completed successfully
                    </span>
                  ) : (
                    <span className="text-red-600">
                      {test.result.error || "Test failed"}
                    </span>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
